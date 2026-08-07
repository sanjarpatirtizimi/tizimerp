import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeviceStatus,
  DriverStatus,
  Prisma,
  RecognitionEventStatus,
  SyncStatus,
  TransactionType,
} from '@prisma/client';
import { timingSafeEqual } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../config/configuration';
import { parseEventLog } from './recognition-event.parser';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'recognitions');

export interface RecognitionOutcome {
  status: RecognitionEventStatus;
  transactionId?: string;
  message: string;
}

@Injectable()
export class RecognitionService {
  private readonly logger = new Logger(RecognitionService.name);
  private readonly appConfig: AppConfig;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.appConfig = configService.get<AppConfig>('app')!;
  }

  /** Constant-time comparison so we don't leak the secret via response-timing. */
  verifyWebhookSecret(providedSecret: string | undefined): void {
    const expected = this.appConfig.security.hikvisionWebhookSecret;
    const provided = providedSecret ?? '';

    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(provided);

    const isValid =
      expectedBuf.length === providedBuf.length &&
      timingSafeEqual(expectedBuf, providedBuf);

    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
  }

  async handleRecognitionEvent(
    deviceId: string,
    rawEventLog: unknown,
    photo?: Buffer,
  ): Promise<RecognitionOutcome> {
    // Zero-config device onboarding: the first event from a never-before-seen
    // deviceId auto-registers it (see class doc on the controller). No
    // manual "Qurilma qo'shish" step required.
    await this.prisma.device.upsert({
      where: { id: deviceId },
      create: {
        id: deviceId,
        name: deviceId,
        status: DeviceStatus.ONLINE,
        lastPingAt: new Date(),
      },
      update: { status: DeviceStatus.ONLINE, lastPingAt: new Date() },
    });

    const parsed = await parseEventLog(rawEventLog);

    if (parsed.validationErrors.length > 0) {
      // Non-fatal: firmware payloads vary a lot between models. Log for
      // visibility but keep processing with whatever we could extract.
      this.logger.warn(
        `[${deviceId}] event_log validation warnings: ${parsed.validationErrors
          .map((e) => Object.values(e.constraints ?? {}).join(', '))
          .join('; ')}`,
      );
    }

    const capturedPhotoUrl = photo
      ? await this.savePhoto(deviceId, photo)
      : undefined;

    if (!parsed.employeeNo) {
      // Not a face-match event (could be a heartbeat, tamper alarm, etc).
      // Still log it for visibility, but don't treat as an error.
      await this.prisma.recognitionEvent.create({
        data: {
          deviceId,
          status: RecognitionEventStatus.UNMATCHED,
          rawPayload: parsed.raw as Prisma.InputJsonValue,
          employeeNoRaw: null,
          eventDateTime: parsed.eventDateTime,
          capturedPhotoUrl,
        },
      });
      return {
        status: RecognitionEventStatus.UNMATCHED,
        message: 'No employeeNo in event payload',
      };
    }

    const driver = await this.resolveDriverByEmployeeNo(
      deviceId,
      parsed.employeeNo,
    );

    if (!driver || driver.status !== DriverStatus.ACTIVE) {
      await this.prisma.recognitionEvent.create({
        data: {
          deviceId,
          driverId: driver?.id,
          status: RecognitionEventStatus.UNMATCHED,
          rawPayload: parsed.raw as Prisma.InputJsonValue,
          employeeNoRaw: parsed.employeeNo,
          eventDateTime: parsed.eventDateTime,
          capturedPhotoUrl,
        },
      });
      return {
        status: RecognitionEventStatus.UNMATCHED,
        message: driver
          ? 'Driver is not active'
          : 'No driver matches this employeeNo',
      };
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Per-driver advisory lock: serializes concurrent recognition events for
        // the SAME driver (e.g. two gates firing within milliseconds of each
        // other) so the cooldown check below can never race. Automatically
        // released when the transaction commits/rolls back.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${driver.id}))`;

        const cooldownMs =
          this.appConfig.business.recognitionCooldownMinutes * 60 * 1000;
        const cooldownStart = new Date(Date.now() - cooldownMs);

        const recentStamp = await tx.recognitionEvent.findFirst({
          where: {
            driverId: driver.id,
            status: RecognitionEventStatus.PROCESSED,
            createdAt: { gte: cooldownStart },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (recentStamp) {
          await tx.recognitionEvent.create({
            data: {
              deviceId,
              driverId: driver.id,
              status: RecognitionEventStatus.IGNORED_COOLDOWN,
              rawPayload: parsed.raw as Prisma.InputJsonValue,
              employeeNoRaw: parsed.employeeNo,
              eventDateTime: parsed.eventDateTime,
              capturedPhotoUrl,
            },
          });
          return {
            status: RecognitionEventStatus.IGNORED_COOLDOWN,
            message: `Driver already stamped at ${recentStamp.createdAt.toISOString()}; within cooldown window`,
          };
        }

        const transaction = await tx.transaction.create({
          data: {
            driverId: driver.id,
            deviceId,
            type: TransactionType.STAMP,
            amount: new Prisma.Decimal(this.appConfig.business.stampAmountUzs),
            description: 'Stamp received (face recognition)',
          },
        });

        await tx.recognitionEvent.create({
          data: {
            deviceId,
            driverId: driver.id,
            status: RecognitionEventStatus.PROCESSED,
            rawPayload: parsed.raw as Prisma.InputJsonValue,
            employeeNoRaw: parsed.employeeNo,
            eventDateTime: parsed.eventDateTime,
            capturedPhotoUrl,
            transactionId: transaction.id,
          },
        });

        return {
          status: RecognitionEventStatus.PROCESSED,
          transactionId: transaction.id,
          message: `Stamp issued: +${this.appConfig.business.stampAmountUzs}`,
        };
      });
    } catch (error) {
      this.logger.error(
        `Failed to process recognition event for driver ${driver.id}: ${(error as Error).message}`,
      );
      await this.prisma.recognitionEvent.create({
        data: {
          deviceId,
          driverId: driver.id,
          status: RecognitionEventStatus.ERROR,
          rawPayload: parsed.raw as Prisma.InputJsonValue,
          employeeNoRaw: parsed.employeeNo,
          eventDateTime: parsed.eventDateTime,
          capturedPhotoUrl,
        },
      });
      throw error;
    }
  }

  /**
   * Drivers enrolled through our platform have their device Person ID set
   * equal to `driver.id` (see `HikvisionService.upsertPerson`). Drivers
   * enrolled directly on the device's own local UI instead get an
   * arbitrary Person ID assigned by the device — those are matched via
   * `DriverDeviceRegistration.hikvisionFaceId`, which gets filled in either:
   *   (a) by staff manually (`DriversService.setManualFaceMapping`), or
   *   (b) automatically here, if this device has a "Ulash rejimi" pairing
   *       window currently armed (`pairingExpiresAt` in the future) — the
   *       FIRST unrecognized face touch on that device claims it.
   * Falls back to treating employeeNo as our driver.id directly, for
   * devices enrolled the old way (direct ISAPI push from this platform).
   */
  private async resolveDriverByEmployeeNo(
    deviceId: string,
    employeeNo: string,
  ) {
    const registration = await this.prisma.driverDeviceRegistration.findFirst({
      where: { deviceId, hikvisionFaceId: employeeNo },
      include: { driver: true },
    });
    if (registration) return registration.driver;

    const claimed = await this.claimPendingPairing(deviceId, employeeNo);
    if (claimed) return claimed;

    return this.prisma.driver.findUnique({ where: { id: employeeNo } });
  }

  /**
   * Looks for a `DriverDeviceRegistration` on this device that's currently
   * "armed" (an operator clicked "Ulash" for a specific driver+device pair
   * and is waiting for the driver to touch their face) and, if found,
   * fills in the Person ID the device just reported — completing the
   * pairing with zero manual data entry.
   */
  private async claimPendingPairing(deviceId: string, employeeNo: string) {
    const pending = await this.prisma.driverDeviceRegistration.findFirst({
      where: {
        deviceId,
        hikvisionFaceId: null,
        pairingExpiresAt: { gt: new Date() },
      },
      include: { driver: true },
    });
    if (!pending) return null;

    await this.prisma.driverDeviceRegistration.update({
      where: { id: pending.id },
      data: {
        hikvisionFaceId: employeeNo,
        syncStatus: SyncStatus.SYNCED,
        syncedAt: new Date(),
        pairingExpiresAt: null,
      },
    });

    this.logger.log(
      `[${deviceId}] pairing claimed: driver ${pending.driverId} <- Person ID "${employeeNo}"`,
    );

    return pending.driver;
  }

  /** Persists the face snapshot the device attached to the event, for audit purposes. */
  private async savePhoto(deviceId: string, buffer: Buffer): Promise<string> {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const fileName = `${deviceId}-${Date.now()}.jpg`;
    await writeFile(join(UPLOAD_DIR, fileName), buffer);
    return `/uploads/recognitions/${fileName}`;
  }
}

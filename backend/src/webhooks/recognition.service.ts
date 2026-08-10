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

    return this.ingestFaceMatch(deviceId, {
      employeeNo: parsed.employeeNo,
      eventDateTime: parsed.eventDateTime,
      capturedPhotoUrl,
      rawPayload: parsed.raw,
    });
  }

  /**
   * Shared stamp pipeline for both cloud webhooks and the local relay-agent
   * AcsEvent poller. Resolves Person ID → driver, applies cooldown, writes ledger.
   */
  async ingestFaceMatch(
    deviceId: string,
    input: {
      employeeNo: string;
      eventDateTime?: Date | null;
      capturedPhotoUrl?: string;
      rawPayload?: unknown;
      dedupeKey?: string;
    },
  ): Promise<RecognitionOutcome> {
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

    const employeeNo = String(input.employeeNo ?? '').trim();
    const rawPayload = {
      ...(typeof input.rawPayload === 'object' && input.rawPayload
        ? (input.rawPayload as Record<string, unknown>)
        : { raw: input.rawPayload }),
      ...(input.dedupeKey ? { agentDedupeKey: input.dedupeKey } : {}),
      source: input.dedupeKey ? 'relay-agent' : 'webhook',
    } as Prisma.InputJsonValue;

    if (input.dedupeKey) {
      const recent = await this.prisma.recognitionEvent.findMany({
        where: {
          deviceId,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { createdAt: 'desc' },
        take: 400,
        select: { rawPayload: true, status: true, transactionId: true },
      });
      const hit = recent.find((row) => {
        const payload = row.rawPayload as { agentDedupeKey?: string } | null;
        return payload?.agentDedupeKey === input.dedupeKey;
      });
      if (hit) {
        return {
          status: hit.status,
          transactionId: hit.transactionId ?? undefined,
          message: `Duplicate event ignored (${input.dedupeKey})`,
        };
      }
    }

    const driver = await this.resolveDriverByEmployeeNo(deviceId, employeeNo);

    if (!driver || driver.status !== DriverStatus.ACTIVE) {
      await this.prisma.recognitionEvent.create({
        data: {
          deviceId,
          driverId: driver?.id,
          status: RecognitionEventStatus.UNMATCHED,
          rawPayload,
          employeeNoRaw: employeeNo,
          eventDateTime: input.eventDateTime ?? undefined,
          capturedPhotoUrl: input.capturedPhotoUrl,
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
              rawPayload,
              employeeNoRaw: employeeNo,
              eventDateTime: input.eventDateTime ?? undefined,
              capturedPhotoUrl: input.capturedPhotoUrl,
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
            rawPayload,
            employeeNoRaw: employeeNo,
            eventDateTime: input.eventDateTime ?? undefined,
            capturedPhotoUrl: input.capturedPhotoUrl,
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
          rawPayload,
          employeeNoRaw: employeeNo,
          eventDateTime: input.eventDateTime ?? undefined,
          capturedPhotoUrl: input.capturedPhotoUrl,
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
    const personId = employeeNo.trim();
    if (!personId) return null;

    // 1) Exact mapping on this webhook device id
    const onDevice = await this.prisma.driverDeviceRegistration.findFirst({
      where: { deviceId, hikvisionFaceId: personId },
      include: { driver: true },
    });
    if (onDevice) return onDevice.driver;

    // 2) Same Person ID linked under a device whose name equals the webhook id
    //    (common when URL uses faceid2 but DB id/name drifted).
    const byDeviceName = await this.prisma.driverDeviceRegistration.findFirst({
      where: {
        hikvisionFaceId: personId,
        device: { name: deviceId },
      },
      include: { driver: true },
    });
    if (byDeviceName) return byDeviceName.driver;

    // 3) Ulash window (if any)
    const claimed = await this.claimPendingPairing(deviceId, personId);
    if (claimed) return claimed;

    // 4) Unique Person ID across the whole system (safe only when exactly one)
    const globalMatches = await this.prisma.driverDeviceRegistration.findMany({
      where: { hikvisionFaceId: personId },
      include: { driver: true },
      take: 3,
    });
    if (globalMatches.length === 1) {
      this.logger.warn(
        `[${deviceId}] matched Person ID "${personId}" via unique global mapping ` +
          `(registration device=${globalMatches[0].deviceId}). Check webhook URL device id.`,
      );
      return globalMatches[0].driver;
    }

    // 5) Platform-enrolled drivers use driver.id as Person ID
    return this.prisma.driver.findUnique({ where: { id: personId } });
  }

  /**
   * Looks for a `DriverDeviceRegistration` on this device that's currently
   * "armed" (or within a short grace after expiry — webhooks often arrive
   * a few seconds late over 4G) and fills in the Person ID the device
   * just reported.
   *
   * Person IDs are local to each Hikvision terminal, so the conflict
   * check is scoped to THIS device only: if another driver is already
   * confirmed with the same Person ID on this device, refuse the claim.
   */
  private async claimPendingPairing(deviceId: string, employeeNo: string) {
    // Accept pairings that expired up to 90s ago so late webhooks still
    // complete Ulash instead of forcing a manual DB fix.
    const graceCutoff = new Date(Date.now() - 90 * 1000);
    const pending = await this.prisma.driverDeviceRegistration.findFirst({
      where: {
        deviceId,
        hikvisionFaceId: null,
        pairingExpiresAt: { gt: graceCutoff },
      },
      include: { driver: true },
    });
    if (!pending) return null;

    const takenOnDevice = await this.prisma.driverDeviceRegistration.findFirst({
      where: {
        deviceId,
        hikvisionFaceId: employeeNo,
        NOT: { driverId: pending.driverId },
      },
    });

    if (takenOnDevice) {
      this.logger.warn(
        `[${deviceId}] Person ID "${employeeNo}" already belongs to driver ` +
          `${takenOnDevice.driverId} on this device. Refusing claim for ` +
          `pending pairing of driver ${pending.driverId}.`,
      );
      return null;
    }

    await this.prisma.driverDeviceRegistration.update({
      where: { id: pending.id },
      data: {
        hikvisionFaceId: employeeNo,
        syncStatus: SyncStatus.SYNCED,
        syncedAt: new Date(),
        pairingExpiresAt: null,
      },
    });

    // Pairing is the enrollment confirmation for new drivers — activate them
    // so the current (and future) recognition events can issue stamps.
    let driver = pending.driver;
    if (driver.status === DriverStatus.PENDING) {
      driver = await this.prisma.driver.update({
        where: { id: driver.id },
        data: { status: DriverStatus.ACTIVE },
      });
      this.logger.log(
        `[${deviceId}] driver ${driver.id} activated after successful pairing`,
      );
    }

    this.logger.log(
      `[${deviceId}] pairing claimed: driver ${pending.driverId} <- Person ID "${employeeNo}"`,
    );

    return driver;
  }

  /** Persists the face snapshot the device attached to the event, for audit purposes. */
  private async savePhoto(deviceId: string, buffer: Buffer): Promise<string> {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const fileName = `${deviceId}-${Date.now()}.jpg`;
    await writeFile(join(UPLOAD_DIR, fileName), buffer);
    return `/uploads/recognitions/${fileName}`;
  }
}

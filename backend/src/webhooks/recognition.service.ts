import {
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DriverStatus,
  Prisma,
  RecognitionEventStatus,
  TransactionType,
} from '@prisma/client';
import { timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfig } from '../config/configuration';
import { parseEventLog } from './recognition-event.parser';

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
  ): Promise<RecognitionOutcome> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });
    if (!device) {
      throw new NotFoundException(`Unknown device: ${deviceId}`);
    }

    const parsed = parseEventLog(rawEventLog);

    if (!parsed.employeeNo) {
      // Not a face-match event (could be a heartbeat, tamper alarm, etc).
      // Still log it for visibility, but don't treat as an error.
      await this.prisma.recognitionEvent.create({
        data: {
          deviceId,
          status: RecognitionEventStatus.UNMATCHED,
          rawPayload: parsed.raw as Prisma.InputJsonValue,
          employeeNoRaw: null,
        },
      });
      return {
        status: RecognitionEventStatus.UNMATCHED,
        message: 'No employeeNo in event payload',
      };
    }

    const driver = await this.prisma.driver.findUnique({
      where: { id: parsed.employeeNo },
    });

    if (!driver || driver.status !== DriverStatus.ACTIVE) {
      await this.prisma.recognitionEvent.create({
        data: {
          deviceId,
          driverId: driver?.id,
          status: RecognitionEventStatus.UNMATCHED,
          rawPayload: parsed.raw as Prisma.InputJsonValue,
          employeeNoRaw: parsed.employeeNo,
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
        },
      });
      throw error;
    }
  }
}

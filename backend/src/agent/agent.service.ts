import { Injectable, NotFoundException } from '@nestjs/common';
import { DriverStatus, SyncStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AckEnrollmentDto } from './dto/ack-enrollment.dto';

export interface PendingEnrollmentJob {
  registrationId: string;
  /** Platform driver id — MUST be used as Hikvision employeeNo / FPID. */
  driverId: string;
  /** Same as driverId; explicit for relay-agent clarity. */
  employeeNo: string;
  fullName: string;
  photoUrl: string;
}

@Injectable()
export class AgentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Jobs waiting for this device's relay agent to push a face under
   * employeeNo = driver.id. Ulash (pairing) rows are excluded — they set
   * pairingExpiresAt and must never be treated as photo-push jobs.
   */
  async listPending(deviceId: string): Promise<PendingEnrollmentJob[]> {
    const registrations = await this.prisma.driverDeviceRegistration.findMany({
      where: {
        deviceId,
        hikvisionFaceId: null,
        pairingExpiresAt: null,
        syncStatus: SyncStatus.PENDING,
        driver: {
          deletedAt: null,
          status: { not: DriverStatus.BLOCKED },
        },
      },
      include: {
        driver: {
          // Do not pull photoBytes — agents fetch via public photo URL.
          select: {
            id: true,
            fullName: true,
            photoUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const jobs: PendingEnrollmentJob[] = [];
    for (const r of registrations) {
      jobs.push({
        registrationId: r.id,
        driverId: r.driverId,
        employeeNo: r.driverId,
        fullName: r.driver.fullName,
        photoUrl: `/api/public/driver-photos/${r.driverId}`,
      });
    }
    return jobs;
  }

  async getStatus(deviceId: string) {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { id: true, name: true },
    });
    const pending = await this.listPending(deviceId);
    return {
      ok: true,
      deviceId: device?.id ?? deviceId,
      name: device?.name ?? deviceId,
      pendingCount: pending.length,
    };
  }

  /**
   * Drops Face ID photo-push jobs on every device and soft-deletes drivers
   * who never received a stamp and were never enrolled on a terminal.
   * Ledger rows and already-synced faces are kept.
   */
  async resetEnrollmentBacklog(): Promise<{
    clearedJobs: number;
    removedDrivers: number;
  }> {
    const photoPushWhere = {
      hikvisionFaceId: null,
      pairingExpiresAt: null,
      syncStatus: { in: [SyncStatus.PENDING, SyncStatus.FAILED] },
    };

    const waitingDrivers = await this.prisma.driver.findMany({
      where: {
        deletedAt: null,
        transactions: { none: {} },
        recognitionEvents: { none: {} },
        deviceRegistrations: {
          none: {
            OR: [
              { hikvisionFaceId: { not: null } },
              { pairingExpiresAt: { gt: new Date() } },
            ],
          },
        },
      },
      select: { id: true, phone: true },
    });

    return this.prisma.$transaction(async (tx) => {
      let removedDrivers = 0;
      if (waitingDrivers.length > 0) {
        const waitingIds = waitingDrivers.map((driver) => driver.id);
        await tx.driverDeviceRegistration.deleteMany({
          where: { driverId: { in: waitingIds } },
        });
        await tx.refreshToken.deleteMany({
          where: { driverId: { in: waitingIds } },
        });
        await tx.otpCode.deleteMany({
          where: { driverId: { in: waitingIds } },
        });
        for (const driver of waitingDrivers) {
          await tx.driver.update({
            where: { id: driver.id },
            data: {
              deletedAt: new Date(),
              status: DriverStatus.BLOCKED,
              phone: `deleted:${driver.id}:${driver.phone}`,
              passwordHash: null,
              photoBytes: null,
              photoUrl: null,
              photoMimeType: null,
            },
          });
        }
        removedDrivers = waitingDrivers.length;
      }

      const cleared = await tx.driverDeviceRegistration.deleteMany({
        where: photoPushWhere,
      });

      return {
        clearedJobs: cleared.count,
        removedDrivers,
      };
    });
  }

  /** Relay reports the outcome of pushing one job to the physical device. */
  async ack(
    deviceId: string,
    registrationId: string,
    dto: AckEnrollmentDto,
  ): Promise<void> {
    const registration = await this.prisma.driverDeviceRegistration.findUnique({
      where: { id: registrationId },
    });
    if (!registration || registration.deviceId !== deviceId) {
      throw new NotFoundException('Registration not found for this device');
    }

    if (dto.success) {
      const personId = registration.driverId;
      await this.prisma.driverDeviceRegistration.update({
        where: { id: registrationId },
        data: {
          hikvisionFaceId: personId,
          syncStatus: SyncStatus.SYNCED,
          syncedAt: new Date(),
          syncError: null,
          pairingExpiresAt: null,
        },
      });

      await this.prisma.driver.updateMany({
        where: { id: registration.driverId, status: DriverStatus.PENDING },
        data: { status: DriverStatus.ACTIVE },
      });
    } else {
      await this.prisma.driverDeviceRegistration.update({
        where: { id: registrationId },
        data: {
          syncStatus: SyncStatus.FAILED,
          syncError: dto.error ?? 'Relay agent reported failure',
        },
      });
    }
  }
}

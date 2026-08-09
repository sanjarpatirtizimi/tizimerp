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
        syncStatus: SyncStatus.PENDING,
        hikvisionFaceId: null,
        pairingExpiresAt: null,
        driver: {
          status: { not: DriverStatus.BLOCKED },
          photoUrl: { not: null },
        },
      },
      include: { driver: true },
      orderBy: { createdAt: 'asc' },
    });

    const jobs: PendingEnrollmentJob[] = [];
    for (const r of registrations) {
      if (!r.driver.photoUrl) continue;
      jobs.push({
        registrationId: r.id,
        driverId: r.driverId,
        employeeNo: r.driverId,
        fullName: r.driver.fullName,
        photoUrl: r.driver.photoUrl,
      });
    }
    return jobs;
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
      // Never trust a foreign Person ID from the agent — unique ID is always
      // our driver.id so recognition can never mix two people up.
      const personId = registration.driverId;
      if (dto.hikvisionFaceId && dto.hikvisionFaceId !== personId) {
        // Soft warning only: still force the correct id.
      }

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

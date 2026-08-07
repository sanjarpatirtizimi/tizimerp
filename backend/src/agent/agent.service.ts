import { Injectable, NotFoundException } from '@nestjs/common';
import { DriverStatus, SyncStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AckEnrollmentDto } from './dto/ack-enrollment.dto';

export interface PendingEnrollmentJob {
  registrationId: string;
  driverId: string;
  fullName: string;
  photoUrl: string | null;
}

@Injectable()
export class AgentService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Jobs waiting for this device's relay agent to push: drivers who were
   * queued for enrollment (via driver creation, or a future re-queue
   * action) but haven't been confirmed synced yet.
   */
  async listPending(deviceId: string): Promise<PendingEnrollmentJob[]> {
    const registrations = await this.prisma.driverDeviceRegistration.findMany({
      where: {
        deviceId,
        syncStatus: SyncStatus.PENDING,
        hikvisionFaceId: null,
      },
      include: { driver: true },
      orderBy: { createdAt: 'asc' },
    });

    return registrations
      .filter((r) => r.driver.status !== DriverStatus.BLOCKED)
      .map((r) => ({
        registrationId: r.id,
        driverId: r.driverId,
        fullName: r.driver.fullName,
        photoUrl: r.driver.photoUrl,
      }));
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
      await this.prisma.driverDeviceRegistration.update({
        where: { id: registrationId },
        data: {
          hikvisionFaceId: dto.hikvisionFaceId ?? registration.driverId,
          syncStatus: SyncStatus.SYNCED,
          syncedAt: new Date(),
          syncError: null,
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

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DriverStatus, SyncStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { HikvisionService } from '../hikvision/hikvision.service';
import { AuditService } from '../audit/audit.service';
import { CreateDriverDto } from './dto/create-driver.dto';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'drivers');

@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hikvisionService: HikvisionService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    dto: CreateDriverDto,
    photo: Express.Multer.File | undefined,
    operatorId: string,
  ) {
    const existing = await this.prisma.driver.findUnique({
      where: { phone: dto.phone },
    });
    if (existing) {
      throw new ConflictException(
        'A driver with this phone number already exists',
      );
    }

    let photoUrl: string | undefined;
    if (photo) {
      photoUrl = await this.savePhoto(dto.phone, photo.buffer);
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : undefined;

    const driver = await this.prisma.driver.create({
      data: {
        fullName: dto.fullName,
        phone: dto.phone,
        passwordHash,
        carPlate: dto.carPlate,
        carBrand: dto.carBrand,
        carModel: dto.carModel,
        photoUrl,
        status: DriverStatus.PENDING,
      },
    });

    await this.auditService.log({
      userId: operatorId,
      action: 'DRIVER_CREATED',
      entityType: 'Driver',
      entityId: driver.id,
      metadata: { phone: dto.phone },
    });

    if (dto.deviceIds?.length && photo) {
      await this.enrollOnDevices(
        driver.id,
        dto.deviceIds,
        photo.buffer,
        operatorId,
      );
    }

    return this.findOne(driver.id);
  }

  async enrollOnDevices(
    driverId: string,
    deviceIds: string[],
    photoBuffer: Buffer,
    operatorId: string,
  ) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const devices = await this.prisma.device.findMany({
      where: { id: { in: deviceIds } },
    });
    let anySynced = false;

    for (const device of devices) {
      const registration = await this.prisma.driverDeviceRegistration.upsert({
        where: { driverId_deviceId: { driverId, deviceId: device.id } },
        create: {
          driverId,
          deviceId: device.id,
          syncStatus: SyncStatus.PENDING,
        },
        update: { syncStatus: SyncStatus.PENDING, syncError: null },
      });

      try {
        const result = await this.hikvisionService.enrollDriver(
          device,
          driverId,
          driver.fullName,
          photoBuffer,
        );
        await this.prisma.driverDeviceRegistration.update({
          where: { id: registration.id },
          data: {
            syncStatus: SyncStatus.SYNCED,
            hikvisionFaceId: result.hikvisionFaceId,
            syncedAt: new Date(),
            syncError: null,
          },
        });
        anySynced = true;
      } catch (error) {
        const message = (error as Error).message;
        this.logger.error(
          `Enrollment failed for driver ${driverId} on device ${device.id}: ${message}`,
        );
        await this.prisma.driverDeviceRegistration.update({
          where: { id: registration.id },
          data: { syncStatus: SyncStatus.FAILED, syncError: message },
        });
      }
    }

    if (anySynced && driver.status === DriverStatus.PENDING) {
      await this.prisma.driver.update({
        where: { id: driverId },
        data: { status: DriverStatus.ACTIVE },
      });
    }

    await this.auditService.log({
      userId: operatorId,
      action: 'DRIVER_DEVICE_ENROLLMENT_ATTEMPTED',
      entityType: 'Driver',
      entityId: driverId,
      metadata: { deviceIds },
    });

    return this.findOne(driverId);
  }

  async findAll(status?: DriverStatus) {
    return this.prisma.driver.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: { deviceRegistrations: { include: { device: true } } },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    return driver;
  }

  async setStatus(id: string, status: DriverStatus, operatorId: string) {
    await this.findOne(id);
    const driver = await this.prisma.driver.update({
      where: { id },
      data: { status },
    });

    await this.auditService.log({
      userId: operatorId,
      action: 'DRIVER_STATUS_CHANGED',
      entityType: 'Driver',
      entityId: id,
      metadata: { status },
    });

    return driver;
  }

  async getProfile(driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    const rest: Partial<typeof driver> = { ...driver };
    delete rest.passwordHash;
    return rest;
  }

  private async savePhoto(phone: string, buffer: Buffer): Promise<string> {
    if (buffer.length === 0) {
      throw new BadRequestException('Uploaded photo is empty');
    }
    await mkdir(UPLOAD_DIR, { recursive: true });
    const fileName = `${phone.replace(/[^\d]/g, '')}-${Date.now()}.jpg`;
    await writeFile(join(UPLOAD_DIR, fileName), buffer);
    return `/uploads/drivers/${fileName}`;
  }
}

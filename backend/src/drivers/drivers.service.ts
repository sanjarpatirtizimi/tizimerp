import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DriverStatus,
  RecognitionEventStatus,
  SyncStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { HikvisionService } from '../hikvision/hikvision.service';
import { AuditService } from '../audit/audit.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { ManualFaceMappingDto } from './dto/manual-face-mapping.dto';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'drivers');
const PAIRING_WINDOW_MS = 3 * 60 * 1000;
/** Look back for face touches that arrived just before the operator armed Ulash. */
const PAIRING_LOOKBACK_MS = 3 * 60 * 1000;

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

    if (dto.deviceIds?.length && !photo) {
      throw new BadRequestException(
        "Qurilmaga avtomatik yuklash uchun haydovchi rasmi majburiy",
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

  /**
   * Re-queues face push for selected devices using the photo already stored
   * on the driver record. Person ID on the device is always `driver.id`.
   */
  async requeueEnrollment(
    driverId: string,
    deviceIds: string[],
    operatorId: string,
  ) {
    if (!deviceIds.length) {
      throw new BadRequestException('Kamida bitta qurilma tanlang');
    }

    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    if (!driver.photoUrl) {
      throw new BadRequestException(
        "Haydovchida rasm yo'q — avval rasm yuklab qayta urinib ko'ring",
      );
    }

    const absolutePath = join(process.cwd(), driver.photoUrl.replace(/^\//, ''));
    let photoBuffer: Buffer;
    try {
      photoBuffer = await readFile(absolutePath);
    } catch {
      throw new BadRequestException(
        "Saqlangan rasm fayli topilmadi — haydovchiga yangi rasm yuklang",
      );
    }

    return this.enrollOnDevices(driverId, deviceIds, photoBuffer, operatorId);
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
      // Always reset to a clean agent/ISAPI job: Person ID will be driver.id
      // after a successful push. Clear any prior Ulash window so the relay
      // agent never confuses a pairing wait with an enrollment job.
      const registration = await this.prisma.driverDeviceRegistration.upsert({
        where: { driverId_deviceId: { driverId, deviceId: device.id } },
        create: {
          driverId,
          deviceId: device.id,
          syncStatus: SyncStatus.PENDING,
          hikvisionFaceId: null,
          pairingExpiresAt: null,
          syncError: null,
          syncedAt: null,
        },
        update: {
          syncStatus: SyncStatus.PENDING,
          hikvisionFaceId: null,
          pairingExpiresAt: null,
          syncError: null,
          syncedAt: null,
        },
      });

      if (device.agentKeyHash) {
        // Local relay agent will poll listPending and push employeeNo=driver.id.
        this.logger.log(
          `Queued agent enrollment for driver ${driverId} on device ${device.id} (Person ID = driver.id)`,
        );
        continue;
      }

      if (!device.ipAddress || !device.username || !device.passwordEnc) {
        await this.prisma.driverDeviceRegistration.update({
          where: { id: registration.id },
          data: {
            syncStatus: SyncStatus.FAILED,
            syncError:
              "Bu qurilmada na ISAPI ma'lumotlari, na relay agent sozlangan — avtomatik yuklab bo'lmadi",
          },
        });
        continue;
      }

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

  /**
   * Records/overwrites the Person ID a device uses to identify this driver,
   * WITHOUT calling the device's ISAPI (no network call to the device at
   * all). Use this when the driver's face was enrolled directly on the
   * device's own local UI — the device assigned its own employeeNo that
   * has nothing to do with our driver.id, so recognition webhooks would
   * otherwise never match.
   */
  async setManualFaceMapping(
    driverId: string,
    dto: ManualFaceMappingDto,
    operatorId: string,
  ) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const device = await this.prisma.device.findUnique({
      where: { id: dto.deviceId },
    });
    if (!device) throw new NotFoundException('Device not found');

    const conflict = await this.prisma.driverDeviceRegistration.findFirst({
      where: {
        deviceId: dto.deviceId,
        hikvisionFaceId: dto.hikvisionFaceId,
        NOT: { driverId },
      },
    });
    if (conflict) {
      throw new ConflictException(
        'This Person ID is already mapped to a different driver on this device',
      );
    }

    await this.prisma.driverDeviceRegistration.upsert({
      where: { driverId_deviceId: { driverId, deviceId: dto.deviceId } },
      create: {
        driverId,
        deviceId: dto.deviceId,
        hikvisionFaceId: dto.hikvisionFaceId,
        syncStatus: SyncStatus.SYNCED,
        syncedAt: new Date(),
      },
      update: {
        hikvisionFaceId: dto.hikvisionFaceId,
        syncStatus: SyncStatus.SYNCED,
        syncedAt: new Date(),
        syncError: null,
      },
    });

    if (driver.status === DriverStatus.PENDING) {
      await this.prisma.driver.update({
        where: { id: driverId },
        data: { status: DriverStatus.ACTIVE },
      });
    }

    await this.auditService.log({
      userId: operatorId,
      action: 'DRIVER_MANUAL_FACE_MAPPING_SET',
      entityType: 'Driver',
      entityId: driverId,
      metadata: {
        deviceId: dto.deviceId,
        hikvisionFaceId: dto.hikvisionFaceId,
      },
    });

    return this.findOne(driverId);
  }

  /**
   * "Ulash rejimi" — operator explicitly picks ONE device (from the list of
   * already-seen devices) to bind to this driver, and arms a 2-minute
   * window during which the very next unrecognized face touch on THAT
   * device auto-completes the link (see `RecognitionService.claimPendingPairing`).
   * A driver can go through this once per device — e.g. once for the gate
   * they leave through, again for the one they come back through — since
   * `DriverDeviceRegistration` is keyed by (driverId, deviceId).
   */
  async startDevicePairing(
    driverId: string,
    deviceId: string,
    operatorId: string,
  ) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });
    if (!device) {
      throw new NotFoundException(
        'Bu qurilma hali tizimga signal yubormagan — avval qurilmani ishga tushiring',
      );
    }

    const busy = await this.prisma.driverDeviceRegistration.findFirst({
      where: {
        deviceId,
        hikvisionFaceId: null,
        pairingExpiresAt: { gt: new Date() },
        NOT: { driverId },
      },
    });
    if (busy) {
      throw new ConflictException(
        "Bu qurilma hozir boshqa haydovchini kutmoqda. Bir necha daqiqadan so'ng qayta urinib ko'ring.",
      );
    }

    const pairingExpiresAt = new Date(Date.now() + PAIRING_WINDOW_MS);
    await this.prisma.driverDeviceRegistration.upsert({
      where: { driverId_deviceId: { driverId, deviceId } },
      create: {
        driverId,
        deviceId,
        syncStatus: SyncStatus.PENDING,
        pairingExpiresAt,
      },
      update: {
        hikvisionFaceId: null,
        syncStatus: SyncStatus.PENDING,
        syncError: null,
        syncedAt: null,
        pairingExpiresAt,
      },
    });

    // If the driver already touched the device a moment ago (common when the
    // operator starts Ulash after the face beep), complete pairing immediately
    // from that recent unmatched recognition — no second touch needed.
    const claimed = await this.claimPairingFromRecentEvents(driverId, deviceId);

    await this.auditService.log({
      userId: operatorId,
      action: claimed
        ? 'DRIVER_DEVICE_PAIRING_AUTO_CLAIMED'
        : 'DRIVER_DEVICE_PAIRING_STARTED',
      entityType: 'Driver',
      entityId: driverId,
      metadata: {
        deviceId,
        ...(claimed ? { hikvisionFaceId: claimed } : {}),
      },
    });

    if (claimed) {
      return {
        deviceId,
        pairingExpiresAt: null as Date | null,
        paired: true as const,
        hikvisionFaceId: claimed,
      };
    }

    return {
      deviceId,
      pairingExpiresAt,
      paired: false as const,
      hikvisionFaceId: null as string | null,
    };
  }

  /**
   * Completes an armed pairing from a recent UNMATCHED recognition on the
   * same device. Only auto-claims when exactly one distinct Person ID
   * appeared in the lookback window (avoids binding the wrong face when
   * several people walked past).
   */
  private async claimPairingFromRecentEvents(
    driverId: string,
    deviceId: string,
  ): Promise<string | null> {
    const since = new Date(Date.now() - PAIRING_LOOKBACK_MS);
    const recent = await this.prisma.recognitionEvent.findMany({
      where: {
        deviceId,
        status: RecognitionEventStatus.UNMATCHED,
        employeeNoRaw: { not: null },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { employeeNoRaw: true },
    });

    const personIds = [
      ...new Set(
        recent
          .map((e) => e.employeeNoRaw)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (personIds.length !== 1) return null;

    const employeeNo = personIds[0];

    const takenOnDevice = await this.prisma.driverDeviceRegistration.findFirst({
      where: {
        deviceId,
        hikvisionFaceId: employeeNo,
        NOT: { driverId },
      },
    });
    if (takenOnDevice) return null;

    await this.prisma.driverDeviceRegistration.update({
      where: { driverId_deviceId: { driverId, deviceId } },
      data: {
        hikvisionFaceId: employeeNo,
        syncStatus: SyncStatus.SYNCED,
        syncedAt: new Date(),
        pairingExpiresAt: null,
        syncError: null,
      },
    });

    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (driver?.status === DriverStatus.PENDING) {
      await this.prisma.driver.update({
        where: { id: driverId },
        data: { status: DriverStatus.ACTIVE },
      });
    }

    this.logger.log(
      `[${deviceId}] pairing auto-claimed from recent event: driver ${driverId} <- Person ID "${employeeNo}"`,
    );
    return employeeNo;
  }

  /** Cancels an armed-but-unconfirmed pairing window before it expires on its own. */
  async cancelDevicePairing(driverId: string, deviceId: string) {
    const registration = await this.prisma.driverDeviceRegistration.findUnique({
      where: { driverId_deviceId: { driverId, deviceId } },
    });
    if (!registration || registration.hikvisionFaceId)
      return this.findOne(driverId);

    await this.prisma.driverDeviceRegistration.delete({
      where: { id: registration.id },
    });
    return this.findOne(driverId);
  }

  /** Unlinks a device that was already successfully paired with this driver. */
  async unlinkDevice(driverId: string, deviceId: string, operatorId: string) {
    const registration = await this.prisma.driverDeviceRegistration.findUnique({
      where: { driverId_deviceId: { driverId, deviceId } },
    });
    if (!registration) throw new NotFoundException("Bog'lanish topilmadi");

    await this.prisma.driverDeviceRegistration.delete({
      where: { id: registration.id },
    });

    await this.auditService.log({
      userId: operatorId,
      action: 'DRIVER_DEVICE_UNLINKED',
      entityType: 'Driver',
      entityId: driverId,
      metadata: { deviceId },
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

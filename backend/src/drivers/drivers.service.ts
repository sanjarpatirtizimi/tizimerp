import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  DriverStatus,
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
      select: { id: true },
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

    if (photo) {
      this.assertPhotoBuffer(photo.buffer);
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : undefined;

    let driver;
    try {
      driver = await this.prisma.driver.create({
        data: {
          fullName: dto.fullName,
          phone: dto.phone,
          passwordHash,
          carPlate: dto.carPlate,
          carBrand: dto.carBrand,
          carModel: dto.carModel,
          photoBytes: photo ? new Uint8Array(photo.buffer) : undefined,
          photoMimeType: photo ? this.mimeFromUpload(photo) : undefined,
          status: DriverStatus.PENDING,
        },
      });
    } catch (error) {
      // Concurrent creates with the same phone (unique constraint).
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        throw new ConflictException(
          'A driver with this phone number already exists',
        );
      }
      throw error;
    }

    // Stable public URL that is served from Postgres (not ephemeral disk).
    if (photo) {
      await this.prisma.driver.update({
        where: { id: driver.id },
        data: { photoUrl: this.publicPhotoPath(driver.id) },
      });
      // Also write a local cache copy for faster agent reads when disk exists.
      await this.cachePhotoToDisk(driver.id, photo.buffer).catch(() => undefined);
    }

    await this.auditService.log({
      userId: operatorId,
      action: 'DRIVER_CREATED',
      entityType: 'Driver',
      entityId: driver.id,
      metadata: { phone: dto.phone },
    });

    // Fast path only: DB queue for relay agents. Never call LAN ISAPI from
    // Render here — that is what froze the API when two operators created
    // drivers at once (private IPs time out for ~10s+ each).
    if (dto.deviceIds?.length && photo) {
      try {
        await this.enrollOnDevices(
          driver.id,
          dto.deviceIds,
          photo.buffer,
          operatorId,
        );
      } catch (error) {
        // Driver is already saved — do not fail the whole create.
        this.logger.error(
          `Enrollment queue after create failed for ${driver.id}: ${(error as Error).message}`,
        );
      }
    }

    return this.findOne(driver.id);
  }

  /** Replace/upload the durable face photo for an existing driver. */
  async updatePhoto(
    driverId: string,
    photo: Express.Multer.File,
    operatorId: string,
  ) {
    this.assertPhotoBuffer(photo.buffer);
    await this.findOne(driverId);

    await this.prisma.driver.update({
      where: { id: driverId },
      data: {
        photoBytes: new Uint8Array(photo.buffer),
        photoMimeType: this.mimeFromUpload(photo),
        photoUrl: this.publicPhotoPath(driverId),
      },
    });
    await this.cachePhotoToDisk(driverId, photo.buffer).catch(() => undefined);

    await this.auditService.log({
      userId: operatorId,
      action: 'DRIVER_PHOTO_UPDATED',
      entityType: 'Driver',
      entityId: driverId,
    });

    return this.findOne(driverId);
  }

  /** Used by the public photo endpoint and by re-queue enrollment. */
  async getStoredPhoto(driverId: string): Promise<{
    buffer: Buffer;
    mimeType: string;
  }> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        photoBytes: true,
        photoMimeType: true,
        photoUrl: true,
      },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    if (driver.photoBytes && driver.photoBytes.length > 0) {
      return {
        buffer: Buffer.from(driver.photoBytes),
        mimeType: driver.photoMimeType ?? 'image/jpeg',
      };
    }

    // Legacy fallback: photo was only on disk before this change.
    if (driver.photoUrl?.startsWith('/uploads/')) {
      try {
        const absolutePath = join(
          process.cwd(),
          driver.photoUrl.replace(/^\//, ''),
        );
        const buffer = await readFile(absolutePath);
        // Backfill into DB so the next Render restart keeps it.
        await this.prisma.driver.update({
          where: { id: driverId },
          data: {
            photoBytes: new Uint8Array(buffer),
            photoMimeType: 'image/jpeg',
            photoUrl: this.publicPhotoPath(driverId),
          },
        });
        return { buffer, mimeType: 'image/jpeg' };
      } catch {
        // fall through
      }
    }

    throw new NotFoundException("Haydovchi rasmi topilmadi");
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
      select: { id: true, photoBytes: true, photoUrl: true },
    });
    if (!driver) throw new NotFoundException('Driver not found');

    let photoBuffer: Buffer;
    try {
      photoBuffer = (await this.getStoredPhoto(driverId)).buffer;
    } catch {
      throw new BadRequestException(
        "Haydovchida rasm yo'q yoki yo'qolgan — haydovchi sahifasidan yangi rasm yuklang",
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
      select: { id: true, fullName: true, status: true },
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

      // Render (cloud) cannot reach office LAN (192.168.x). Attempting ISAPI
      // here blocks the Node process for many seconds and crashes the API
      // under concurrent creates. Require relay agent instead.
      if (
        !device.ipAddress ||
        this.isPrivateLanIp(device.ipAddress) ||
        !device.username ||
        !device.passwordEnc
      ) {
        await this.prisma.driverDeviceRegistration.update({
          where: { id: registration.id },
          data: {
            syncStatus: SyncStatus.FAILED,
            syncError:
              "Cloud server Face IDga to'g'ridan-to'g'ri ulana olmaydi. Qurilmalar → Agent kaliti + relay-agent ishga tushiring",
          },
        });
        continue;
      }

      // Public/routable device only (rare). Keep timeouts small via Hikvision client.
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

  /** True for RFC1918 / loopback — unreachable from Render cloud. */
  private isPrivateLanIp(ip: string): boolean {
    const v = ip.trim();
    return (
      v === 'localhost' ||
      /^127\./.test(v) ||
      /^10\./.test(v) ||
      /^192\.168\./.test(v) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(v)
    );
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

    const faceId = dto.hikvisionFaceId.trim();
    if (!faceId) {
      throw new BadRequestException('Person ID bo\'sh bo\'lishi mumkin emas');
    }

    const conflict = await this.prisma.driverDeviceRegistration.findFirst({
      where: {
        deviceId: dto.deviceId,
        hikvisionFaceId: faceId,
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
        hikvisionFaceId: faceId,
        syncStatus: SyncStatus.SYNCED,
        syncedAt: new Date(),
        pairingExpiresAt: null,
        syncError: null,
      },
      update: {
        hikvisionFaceId: faceId,
        syncStatus: SyncStatus.SYNCED,
        syncedAt: new Date(),
        pairingExpiresAt: null,
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
        hikvisionFaceId: faceId,
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

    // Only faces seen AFTER Ulash starts may claim this driver. We deliberately
    // do not auto-bind recent pre-start unmatched events — that could attach
    // someone else's Person ID to this account.
    await this.auditService.log({
      userId: operatorId,
      action: 'DRIVER_DEVICE_PAIRING_STARTED',
      entityType: 'Driver',
      entityId: driverId,
      metadata: { deviceId },
    });

    return {
      deviceId,
      pairingExpiresAt,
      paired: false as const,
      hikvisionFaceId: null as string | null,
    };
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
    const drivers = await this.prisma.driver.findMany({
      where: {
        deletedAt: null,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      // Never load BYTEA photos into list responses (OOM under concurrent use).
      omit: { photoBytes: true, passwordHash: true },
    });
    return drivers.map((d) => this.sanitizeDriver(d));
  }

  async findOne(id: string) {
    const driver = await this.prisma.driver.findFirst({
      where: { id, deletedAt: null },
      include: { deviceRegistrations: { include: { device: true } } },
      omit: { photoBytes: true, passwordHash: true },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    return this.sanitizeDriver(driver);
  }

  async update(
    id: string,
    dto: {
      fullName?: string;
      phone?: string;
      password?: string;
      carPlate?: string;
      carBrand?: string;
      carModel?: string;
    },
    operatorId: string,
  ) {
    await this.findOne(id);

    if (dto.phone) {
      const phoneTaken = await this.prisma.driver.findFirst({
        where: { phone: dto.phone, NOT: { id } },
      });
      if (phoneTaken) {
        throw new ConflictException(
          'Bu telefon raqami boshqa haydovchiga biriktirilgan',
        );
      }
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : undefined;

    const driver = await this.prisma.driver.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(passwordHash ? { passwordHash } : {}),
        ...(dto.carPlate !== undefined ? { carPlate: dto.carPlate || null } : {}),
        ...(dto.carBrand !== undefined ? { carBrand: dto.carBrand || null } : {}),
        ...(dto.carModel !== undefined ? { carModel: dto.carModel || null } : {}),
      },
    });

    await this.auditService.log({
      userId: operatorId,
      action: 'DRIVER_UPDATED',
      entityType: 'Driver',
      entityId: id,
      metadata: {
        fields: Object.keys(dto).filter(
          (k) => dto[k as keyof typeof dto] !== undefined,
        ),
      },
    });

    return this.findOne(driver.id);
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

    return this.sanitizeDriver(driver);
  }

  /**
   * Soft-delete a driver. Ledger (transactions) and recognition history are
   * kept for audit. Phone is freed for reuse; sessions and device links go.
   */
  async softDelete(id: string, operatorId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: {
        deviceRegistrations: { include: { device: true } },
      },
    });
    if (!driver || driver.deletedAt) {
      throw new NotFoundException('Driver not found');
    }

    for (const registration of driver.deviceRegistrations) {
      const device = registration.device;
      if (
        registration.hikvisionFaceId &&
        device.ipAddress &&
        device.username &&
        device.passwordEnc
      ) {
        try {
          await this.hikvisionService.removeDriver(device, driver.id);
        } catch (error) {
          this.logger.warn(
            `Could not remove face for driver ${id} from device ${device.id}: ${(error as Error).message}`,
          );
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.driverDeviceRegistration.deleteMany({ where: { driverId: id } });
      await tx.refreshToken.deleteMany({ where: { driverId: id } });
      await tx.otpCode.deleteMany({ where: { driverId: id } });
      await tx.driver.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          status: DriverStatus.BLOCKED,
          // Free the unique phone for a future re-registration.
          phone: `deleted:${id}:${driver.phone}`,
          passwordHash: null,
          photoBytes: null,
          photoUrl: null,
          photoMimeType: null,
        },
      });
    });

    await this.auditService.log({
      userId: operatorId,
      action: 'DRIVER_DELETED',
      entityType: 'Driver',
      entityId: id,
      metadata: {
        fullName: driver.fullName,
        phone: driver.phone,
      },
    });

    return { ok: true };
  }

  async getProfile(driverId: string) {
    const driver = await this.prisma.driver.findFirst({
      where: { id: driverId, deletedAt: null },
      omit: { photoBytes: true, passwordHash: true },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    return this.sanitizeDriver(driver);
  }

  /** Normalize @username / phone text; empty clears the field. */
  async setTelegramUsername(
    driverId: string,
    telegramUsername: string | null | undefined,
    actorId?: string,
  ) {
    await this.findOne(driverId);
    const normalized = this.normalizeTelegramUsername(telegramUsername);
    const driver = await this.prisma.driver.update({
      where: { id: driverId },
      data: { telegramUsername: normalized },
    });
    if (actorId) {
      await this.auditService.log({
        userId: actorId,
        action: 'DRIVER_TELEGRAM_UPDATED',
        entityType: 'Driver',
        entityId: driverId,
        metadata: { telegramUsername: normalized },
      });
    }
    return this.sanitizeDriver(driver);
  }

  private normalizeTelegramUsername(
    value: string | null | undefined,
  ): string | null {
    if (value == null) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('@')) return trimmed.slice(0, 64);
    return trimmed.slice(0, 64);
  }

  private publicPhotoPath(driverId: string): string {
    return `/api/public/driver-photos/${driverId}`;
  }

  private mimeFromUpload(photo: Express.Multer.File): string {
    return photo.mimetype?.startsWith('image/')
      ? photo.mimetype
      : 'image/jpeg';
  }

  private assertPhotoBuffer(buffer: Buffer) {
    if (!buffer?.length) {
      throw new BadRequestException('Uploaded photo is empty');
    }
    if (buffer.length > 8 * 1024 * 1024) {
      throw new BadRequestException('Rasm 8 MB dan katta bo‘lmasligi kerak');
    }
  }

  private async cachePhotoToDisk(driverId: string, buffer: Buffer) {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(join(UPLOAD_DIR, `${driverId}.jpg`), buffer);
  }

  /** Never leak password hashes or raw photo bytes in JSON responses. */
  private sanitizeDriver<T extends object>(driver: T): Omit<T, 'passwordHash' | 'photoBytes'> {
    const clone = { ...driver } as T & {
      passwordHash?: string | null;
      photoBytes?: Uint8Array | Buffer | null;
    };
    delete clone.passwordHash;
    delete clone.photoBytes;
    return clone;
  }
}

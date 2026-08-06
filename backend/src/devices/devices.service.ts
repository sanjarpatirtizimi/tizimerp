import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeviceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { HikvisionService } from '../hikvision/hikvision.service';
import { encryptSecret } from '../common/utils/crypto.util';
import { AppConfig } from '../config/configuration';

@Injectable()
export class DevicesService {
  private readonly encKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly hikvisionService: HikvisionService,
    configService: ConfigService,
  ) {
    this.encKey =
      configService.get<AppConfig>('app')!.security.deviceCredentialsEncKey;
  }

  async create(dto: CreateDeviceDto) {
    const port = dto.port ?? 80;
    const existing = await this.prisma.device.findUnique({
      where: { ipAddress_port: { ipAddress: dto.ipAddress, port } },
    });
    if (existing) {
      throw new ConflictException(
        'A device with this IP address and port already exists',
      );
    }

    const device = await this.prisma.device.create({
      data: {
        name: dto.name,
        ipAddress: dto.ipAddress,
        port,
        username: dto.username,
        passwordEnc: encryptSecret(dto.password, this.encKey),
        location: dto.location,
        status: DeviceStatus.OFFLINE,
      },
    });

    return this.sanitize(device);
  }

  async findAll() {
    const devices = await this.prisma.device.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return devices.map((d) => this.sanitize(d));
  }

  async findOne(id: string) {
    const device = await this.prisma.device.findUnique({ where: { id } });
    if (!device) throw new NotFoundException('Device not found');
    return device;
  }

  async update(id: string, dto: UpdateDeviceDto) {
    const device = await this.findOne(id);

    const nextIpAddress = dto.ipAddress ?? device.ipAddress;
    const nextPort = dto.port ?? device.port;
    if (nextIpAddress !== device.ipAddress || nextPort !== device.port) {
      const conflict = await this.prisma.device.findUnique({
        where: { ipAddress_port: { ipAddress: nextIpAddress, port: nextPort } },
      });
      if (conflict && conflict.id !== id) {
        throw new ConflictException(
          'A device with this IP address and port already exists',
        );
      }
    }

    const updated = await this.prisma.device.update({
      where: { id },
      data: {
        name: dto.name,
        ipAddress: dto.ipAddress,
        port: dto.port,
        username: dto.username,
        location: dto.location,
        ...(dto.password
          ? { passwordEnc: encryptSecret(dto.password, this.encKey) }
          : {}),
      },
    });

    return this.sanitize(updated);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    try {
      await this.prisma.device.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'This device already has recorded activity (recognition events or transactions) and cannot be deleted. Remove/reassign that history first, or keep the device disabled instead.',
        );
      }
      throw error;
    }
  }

  async checkHealth(id: string) {
    const device = await this.findOne(id);
    const online = await this.hikvisionService.ping(device);
    const updated = await this.prisma.device.update({
      where: { id },
      data: {
        status: online ? DeviceStatus.ONLINE : DeviceStatus.ERROR,
        lastPingAt: new Date(),
      },
    });
    return this.sanitize(updated);
  }

  private sanitize<T extends { passwordEnc: string }>(
    device: T,
  ): Omit<T, 'passwordEnc'> {
    const rest: Partial<T> = { ...device };
    delete rest.passwordEnc;
    return rest as Omit<T, 'passwordEnc'>;
  }
}

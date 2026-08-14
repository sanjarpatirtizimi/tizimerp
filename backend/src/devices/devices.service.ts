import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DeviceStatus, Prisma } from '@prisma/client';
import { randomBytes, createHash, timingSafeEqual } from 'crypto';
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
    if (dto.ipAddress) {
      const existing = await this.prisma.device.findFirst({
        where: { ipAddress: dto.ipAddress, port },
      });
      if (existing) {
        throw new ConflictException(
          'A device with this IP address and port already exists',
        );
      }
    }

    const device = await this.prisma.device.create({
      data: {
        name: dto.name,
        ipAddress: dto.ipAddress,
        port,
        username: dto.username,
        passwordEnc: dto.password
          ? encryptSecret(dto.password, this.encKey)
          : undefined,
        location: dto.location,
        status: DeviceStatus.OFFLINE,
      },
    });

    return this.sanitize(device);
  }

  /**
   * Called from the recognition webhook when the `:deviceId` URL segment
   * doesn't match any known device. Rather than rejecting the request,
   * silently registers a new zero-config Device row so the operator never
   * has to "add" a device manually first — they just pick any identifier
   * (e.g. "darvoza1") when configuring the physical terminal's HTTP
   * Listening Host, and it shows up in the Qurilmalar list automatically.
   * The shared webhook secret is what actually gates this, not this check.
   */
  async findOrAutoCreate(deviceKey: string) {
    const existing = await this.prisma.device.findUnique({
      where: { id: deviceKey },
    });
    if (existing) return existing;

    return this.prisma.device.create({
      data: {
        id: deviceKey,
        name: deviceKey,
        status: DeviceStatus.ONLINE,
        lastPingAt: new Date(),
      },
    });
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

  /** Same as `findOne`, but safe to return directly from the API. */
  async findOnePublic(id: string) {
    return this.sanitize(await this.findOne(id));
  }

  async update(id: string, dto: UpdateDeviceDto) {
    const device = await this.findOne(id);

    const nextIpAddress = dto.ipAddress ?? device.ipAddress;
    const nextPort = dto.port ?? device.port;
    if (
      nextIpAddress &&
      (nextIpAddress !== device.ipAddress || nextPort !== device.port)
    ) {
      const conflict = await this.prisma.device.findFirst({
        where: { ipAddress: nextIpAddress, port: nextPort },
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

  /**
   * Issues a brand-new API key for this device's local "relay agent" —
   * invalidates any previously-issued key. Only the SHA-256 hash is stored;
   * the plaintext is returned exactly once and must be copied into the
   * relay agent's config immediately.
   */
  async generateAgentKey(id: string): Promise<{ agentKey: string }> {
    await this.findOne(id);
    const agentKey = randomBytes(24).toString('hex');
    await this.prisma.device.update({
      where: { id },
      data: {
        agentKeyHash: this.hashAgentKey(agentKey),
        agentKeyCreatedAt: new Date(),
      },
    });
    return { agentKey };
  }

  async revokeAgentKey(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.device.update({
      where: { id },
      data: { agentKeyHash: null, agentKeyCreatedAt: null },
    });
  }

  /** Used by AgentKeyGuard. Resolves by URL id, name, or unique agent key hash. */
  async verifyAgentKey(deviceId: string, providedKey: string) {
    const hash = this.hashAgentKey(providedKey);

    let device = await this.prisma.device.findUnique({
      where: { id: deviceId },
    });
    if (!device) {
      device = await this.prisma.device.findFirst({
        where: { name: deviceId },
      });
    }

    const keyMatches = (row: typeof device) => {
      if (!row?.agentKeyHash) return false;
      const expected = Buffer.from(row.agentKeyHash);
      const actual = Buffer.from(hash);
      return (
        expected.length === actual.length &&
        timingSafeEqual(expected, actual)
      );
    };

    if (!keyMatches(device)) {
      device = await this.prisma.device.findFirst({
        where: { agentKeyHash: hash },
      });
    }

    if (!device?.agentKeyHash || !keyMatches(device)) {
      throw new UnauthorizedException(
        'Invalid agent key or unknown device — Qurilmalar → Agent kaliti',
      );
    }
    return device;
  }

  private hashAgentKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  async checkHealth(id: string) {
    const device = await this.findOne(id);
    if (!device.ipAddress || !device.username || !device.passwordEnc) {
      throw new BadRequestException(
        'This device has no ISAPI credentials configured (IP/username/password) — nothing to ping. It only receives webhook events.',
      );
    }
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

  private sanitize<
    T extends { passwordEnc: string | null; agentKeyHash: string | null },
  >(
    device: T,
  ): Omit<T, 'passwordEnc' | 'agentKeyHash'> & { hasAgent: boolean } {
    const rest: Partial<T> = { ...device };
    const hasAgent = !!device.agentKeyHash;
    delete rest.passwordEnc;
    delete rest.agentKeyHash;
    return { ...(rest as Omit<T, 'passwordEnc' | 'agentKeyHash'>), hasAgent };
  }
}

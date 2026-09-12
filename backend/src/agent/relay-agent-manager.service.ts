import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { simplifyLog } from './log-simplifier';
import { AgentLogDto, AgentHeartbeatDto } from './dto/agent-log.dto';

export interface AgentConfigPayload {
  pollIntervalMs?: number;
  stampPollEnabled?: boolean;
  stampIntervalMs?: number;
  enrollmentEveryMs?: number;
}

@Injectable()
export class RelayAgentManagerService {
  constructor(private readonly prisma: PrismaService) {}

  /** Relay agent logs a message (called from agent-authenticated endpoint). */
  async saveLog(deviceId: string, dto: AgentLogDto): Promise<void> {
    const raw = dto.raw ?? dto.message;
    const simplified = simplifyLog(raw);

    await this.prisma.agentLog.create({
      data: {
        deviceId,
        level: dto.level ?? simplified.level,
        message: simplified.message,
        raw,
      },
    });

    // Keep only the last 500 logs per device to avoid unbounded growth.
    const oldest = await this.prisma.agentLog.findMany({
      where: { deviceId },
      orderBy: { createdAt: 'desc' },
      skip: 500,
      select: { id: true },
    });
    if (oldest.length > 0) {
      await this.prisma.agentLog.deleteMany({
        where: { id: { in: oldest.map((l) => l.id) } },
      });
    }
  }

  /** Relay agent heartbeat — updates version and last-seen timestamp. */
  async heartbeat(deviceId: string, dto: AgentHeartbeatDto): Promise<{ config: AgentConfigPayload | null }> {
    const device = await this.prisma.device.update({
      where: { id: deviceId },
      data: {
        agentLastSeenAt: new Date(),
        ...(dto.version ? { agentVersion: dto.version } : {}),
      },
      select: { agentConfig: true },
    });

    return { config: (device.agentConfig as AgentConfigPayload | null) ?? null };
  }

  /** List all devices that have an agent key, with recent log info. */
  async listAgents() {
    const devices = await this.prisma.device.findMany({
      where: { agentKeyHash: { not: null } },
      orderBy: { agentLastSeenAt: { sort: 'desc', nulls: 'last' } },
      select: {
        id: true,
        name: true,
        location: true,
        status: true,
        agentVersion: true,
        agentLastSeenAt: true,
        agentConfig: true,
        agentKeyCreatedAt: true,
        agentLogs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { message: true, level: true, createdAt: true },
        },
      },
    });

    return devices.map((d) => ({
      id: d.id,
      name: d.name,
      location: d.location,
      deviceStatus: d.status,
      agentVersion: d.agentVersion,
      agentLastSeenAt: d.agentLastSeenAt,
      agentConfig: d.agentConfig as AgentConfigPayload | null,
      agentKeyCreatedAt: d.agentKeyCreatedAt,
      lastLog: d.agentLogs[0] ?? null,
      isOnline: d.agentLastSeenAt
        ? Date.now() - d.agentLastSeenAt.getTime() < 3 * 60 * 1000 // 3 min
        : false,
    }));
  }

  /** Get paginated logs for one device. */
  async getLogs(deviceId: string, limit = 100) {
    return this.prisma.agentLog.findMany({
      where: { deviceId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 300),
      select: {
        id: true,
        level: true,
        message: true,
        raw: true,
        createdAt: true,
      },
    });
  }

  /** Clear logs for a device. */
  async clearLogs(deviceId: string) {
    const { count } = await this.prisma.agentLog.deleteMany({ where: { deviceId } });
    return { cleared: count };
  }

  /** Get remote config for a device. */
  async getConfig(deviceId: string): Promise<AgentConfigPayload | null> {
    const device = await this.prisma.device.findUnique({
      where: { id: deviceId },
      select: { agentConfig: true },
    });
    return (device?.agentConfig as AgentConfigPayload | null) ?? null;
  }

  /** Save remote config for a device. */
  async setConfig(deviceId: string, config: AgentConfigPayload) {
    await this.prisma.device.update({
      where: { id: deviceId },
      // Prisma Json field requires unknown cast
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { agentConfig: config as any },
    });
    return { ok: true, config };
  }
}

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { UpdateAdDto } from './dto/update-ad.dto';

type AdRow = {
  id: string;
  title: string;
  body: string | null;
  phone: string | null;
  telegramUsername: string | null;
  linkUrl: string | null;
  imageUrl: string | null;
  imageBytes?: Uint8Array | Buffer | null;
  imageMimeType: string | null;
  startsAt: Date;
  endsAt: Date;
  audiencePercent: number | null;
  isActive: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Stable 0–99 bucket so the same driver stays in/out of an ad's audience %.
 */
export function audienceBucket(adId: string, driverId: string): number {
  let hash = 2166136261;
  const key = `${adId}:${driverId}`;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 100;
}

export function isInAudience(
  adId: string,
  driverId: string,
  audiencePercent: number | null,
): boolean {
  if (audiencePercent == null || audiencePercent >= 100) return true;
  if (audiencePercent <= 0) return false;
  return audienceBucket(adId, driverId) < audiencePercent;
}

@Injectable()
export class AdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateAdDto, createdById: string) {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (!(startsAt < endsAt)) {
      throw new BadRequestException(
        'Boshlanish vaqti tugashdan oldin bo‘lishi kerak',
      );
    }

    const ad = await this.prisma.ad.create({
      data: {
        title: dto.title.trim(),
        body: dto.body?.trim() || null,
        phone: dto.phone?.trim() || null,
        telegramUsername: this.normalizeTelegram(dto.telegramUsername),
        linkUrl: dto.linkUrl?.trim() || null,
        startsAt,
        endsAt,
        audiencePercent: dto.audiencePercent ?? null,
        createdById,
      },
    });

    await this.auditService.log({
      userId: createdById,
      action: 'AD_CREATED',
      entityType: 'Ad',
      entityId: ad.id,
      metadata: {
        title: ad.title,
        startsAt: ad.startsAt.toISOString(),
        endsAt: ad.endsAt.toISOString(),
        audiencePercent: ad.audiencePercent,
      },
    });

    return this.toPublic(ad);
  }

  async listForStaff() {
    const ads = await this.prisma.ad.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        _count: { select: { dismissals: true } },
      },
    });
    return ads.map((ad) => ({
      ...this.toPublic(ad),
      createdBy: ad.createdBy,
      dismissalsCount: ad._count.dismissals,
    }));
  }

  async update(id: string, dto: UpdateAdDto, userId: string) {
    const existing = await this.prisma.ad.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Reklama topilmadi');

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : existing.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : existing.endsAt;
    if (!(startsAt < endsAt)) {
      throw new BadRequestException(
        'Boshlanish vaqti tugashdan oldin bo‘lishi kerak',
      );
    }

    const data: Prisma.AdUpdateInput = {
      startsAt,
      endsAt,
    };
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.body !== undefined) data.body = dto.body.trim() || null;
    if (dto.phone !== undefined) data.phone = dto.phone.trim() || null;
    if (dto.telegramUsername !== undefined) {
      data.telegramUsername = this.normalizeTelegram(dto.telegramUsername);
    }
    if (dto.linkUrl !== undefined) data.linkUrl = dto.linkUrl.trim() || null;
    if (dto.audiencePercent !== undefined) {
      data.audiencePercent = dto.audiencePercent;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const ad = await this.prisma.ad.update({ where: { id }, data });

    await this.auditService.log({
      userId,
      action: 'AD_UPDATED',
      entityType: 'Ad',
      entityId: ad.id,
      metadata: { ...dto },
    });

    return this.toPublic(ad);
  }

  async deactivate(id: string, userId: string) {
    const existing = await this.prisma.ad.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Reklama topilmadi');

    const ad = await this.prisma.ad.update({
      where: { id },
      data: { isActive: false },
    });

    await this.auditService.log({
      userId,
      action: 'AD_DEACTIVATED',
      entityType: 'Ad',
      entityId: ad.id,
    });

    return this.toPublic(ad);
  }

  async uploadImage(id: string, file: Express.Multer.File, userId: string) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Rasm fayli kerak');
    }
    const existing = await this.prisma.ad.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Reklama topilmadi');

    const mimeType = file.mimetype?.startsWith('image/')
      ? file.mimetype
      : 'image/jpeg';
    const imageUrl = `/api/public/ad-images/${id}`;

    const ad = await this.prisma.ad.update({
      where: { id },
      data: {
        imageBytes: new Uint8Array(file.buffer),
        imageMimeType: mimeType,
        imageUrl,
      },
    });

    await this.auditService.log({
      userId,
      action: 'AD_IMAGE_UPLOADED',
      entityType: 'Ad',
      entityId: ad.id,
      metadata: { mimeType, bytes: file.buffer.length },
    });

    return this.toPublic(ad);
  }

  async getStoredImage(id: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const ad = await this.prisma.ad.findUnique({
      where: { id },
      select: { imageBytes: true, imageMimeType: true },
    });
    if (!ad?.imageBytes || ad.imageBytes.length === 0) {
      throw new NotFoundException('Rasm topilmadi');
    }
    return {
      buffer: Buffer.from(ad.imageBytes),
      mimeType: ad.imageMimeType || 'image/jpeg',
    };
  }

  /**
   * One active, in-window, non-dismissed ad for this driver (audience %).
   * Newest first.
   */
  async getActiveForDriver(driverId: string) {
    const now = new Date();
    const candidates = await this.prisma.ad.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gt: now },
        dismissals: { none: { driverId } },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });

    const match = candidates.find((ad) =>
      isInAudience(ad.id, driverId, ad.audiencePercent),
    );
    return match ? this.toPublic(match) : null;
  }

  async dismissForDriver(adId: string, driverId: string) {
    const ad = await this.prisma.ad.findUnique({ where: { id: adId } });
    if (!ad) throw new NotFoundException('Reklama topilmadi');

    await this.prisma.adDismissal.upsert({
      where: { adId_driverId: { adId, driverId } },
      create: { adId, driverId },
      update: { dismissedAt: new Date() },
    });

    return { ok: true };
  }

  private normalizeTelegram(raw?: string | null): string | null {
    if (!raw) return null;
    const trimmed = raw.trim().replace(/^@/, '');
    return trimmed || null;
  }

  private toPublic(ad: AdRow) {
    const hasImage = Boolean(ad.imageBytes?.length || ad.imageUrl);
    return {
      id: ad.id,
      title: ad.title,
      body: ad.body,
      phone: ad.phone,
      telegramUsername: ad.telegramUsername,
      linkUrl: ad.linkUrl,
      imageUrl: hasImage ? ad.imageUrl ?? `/api/public/ad-images/${ad.id}` : null,
      startsAt: ad.startsAt,
      endsAt: ad.endsAt,
      audiencePercent: ad.audiencePercent,
      isActive: ad.isActive,
      createdById: ad.createdById,
      createdAt: ad.createdAt,
      updatedAt: ad.updatedAt,
    };
  }
}

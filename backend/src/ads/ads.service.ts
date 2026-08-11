import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdKind, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { UpdateAdDto } from './dto/update-ad.dto';

type SlideRow = {
  id: string;
  adId: string;
  sortOrder: number;
  title: string | null;
  body: string | null;
  imageUrl: string | null;
  imageBytes?: Uint8Array | Buffer | null;
  imageMimeType: string | null;
  createdAt: Date;
};

type AdWithSlides = {
  id: string;
  kind: AdKind;
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
  slides?: SlideRow[];
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

    const kind = dto.kind ?? AdKind.POPUP;

    const ad = await this.prisma.ad.create({
      data: {
        kind,
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
      include: { slides: { orderBy: { sortOrder: 'asc' } } },
    });

    await this.auditService.log({
      userId: createdById,
      action: 'AD_CREATED',
      entityType: 'Ad',
      entityId: ad.id,
      metadata: {
        kind: ad.kind,
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
        slides: { orderBy: { sortOrder: 'asc' } },
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

    const ad = await this.prisma.ad.update({
      where: { id },
      data,
      include: { slides: { orderBy: { sortOrder: 'asc' } } },
    });

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
      include: { slides: { orderBy: { sortOrder: 'asc' } } },
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
    if (existing.kind === AdKind.SLIDESHOW) {
      throw new BadRequestException(
        'Slaydli reklama uchun /slides orqali kamida 2 ta rasm yuklang',
      );
    }

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
      include: { slides: { orderBy: { sortOrder: 'asc' } } },
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

  async addSlide(
    adId: string,
    file: Express.Multer.File,
    userId: string,
    opts?: { title?: string; body?: string },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Rasm fayli kerak');
    }
    const ad = await this.prisma.ad.findUnique({
      where: { id: adId },
      include: { slides: true },
    });
    if (!ad) throw new NotFoundException('Reklama topilmadi');
    if (ad.kind !== AdKind.SLIDESHOW) {
      throw new BadRequestException(
        'Faqat slaydli reklamalarga slayd qo‘shiladi',
      );
    }

    const sortOrder =
      ad.slides.reduce((max, s) => Math.max(max, s.sortOrder), -1) + 1;
    const mimeType = file.mimetype?.startsWith('image/')
      ? file.mimetype
      : 'image/jpeg';

    const slide = await this.prisma.adSlide.create({
      data: {
        adId,
        sortOrder,
        title: opts?.title?.trim() || null,
        body: opts?.body?.trim() || null,
        imageBytes: new Uint8Array(file.buffer),
        imageMimeType: mimeType,
      },
    });

    const imageUrl = `/api/public/ad-slide-images/${slide.id}`;
    await this.prisma.adSlide.update({
      where: { id: slide.id },
      data: { imageUrl },
    });

    await this.auditService.log({
      userId,
      action: 'AD_SLIDE_ADDED',
      entityType: 'Ad',
      entityId: adId,
      metadata: { slideId: slide.id, sortOrder },
    });

    const refreshed = await this.prisma.ad.findUniqueOrThrow({
      where: { id: adId },
      include: { slides: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.toPublic(refreshed);
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

  async getStoredSlideImage(
    slideId: string,
  ): Promise<{ buffer: Buffer; mimeType: string }> {
    const slide = await this.prisma.adSlide.findUnique({
      where: { id: slideId },
      select: { imageBytes: true, imageMimeType: true },
    });
    if (!slide?.imageBytes || slide.imageBytes.length === 0) {
      throw new NotFoundException('Slayd rasmi topilmadi');
    }
    return {
      buffer: Buffer.from(slide.imageBytes),
      mimeType: slide.imageMimeType || 'image/jpeg',
    };
  }

  /**
   * Active POPUP (dismissible) + SLIDESHOW (banner) for this driver.
   */
  async getActiveForDriver(driverId: string) {
    const now = new Date();
    const candidates = await this.prisma.ad.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
      include: { slides: { orderBy: { sortOrder: 'asc' } } },
    });

    const inAudience = candidates.filter((ad) =>
      isInAudience(ad.id, driverId, ad.audiencePercent),
    );

    const dismissed = await this.prisma.adDismissal.findMany({
      where: {
        driverId,
        adId: { in: inAudience.map((a) => a.id) },
      },
      select: { adId: true },
    });
    const dismissedIds = new Set(dismissed.map((d) => d.adId));

    const popup = inAudience.find(
      (ad) => ad.kind === AdKind.POPUP && !dismissedIds.has(ad.id),
    );
    const slideshow = inAudience.find(
      (ad) =>
        ad.kind === AdKind.SLIDESHOW &&
        (ad.slides?.filter((s) => s.imageBytes?.length || s.imageUrl).length ??
          0) >= 2,
    );

    return {
      popup: popup ? this.toPublic(popup) : null,
      slideshow: slideshow ? this.toPublic(slideshow) : null,
    };
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

  private toPublic(ad: AdWithSlides) {
    const hasImage = Boolean(ad.imageBytes?.length || ad.imageUrl);
    const slides = (ad.slides ?? []).map((s) => {
      const slideHasImage = Boolean(s.imageBytes?.length || s.imageUrl);
      return {
        id: s.id,
        sortOrder: s.sortOrder,
        title: s.title,
        body: s.body,
        imageUrl: slideHasImage
          ? s.imageUrl ?? `/api/public/ad-slide-images/${s.id}`
          : null,
      };
    });

    return {
      id: ad.id,
      kind: ad.kind,
      title: ad.title,
      body: ad.body,
      phone: ad.phone,
      telegramUsername: ad.telegramUsername,
      linkUrl: ad.linkUrl,
      imageUrl: hasImage
        ? ad.imageUrl ?? `/api/public/ad-images/${ad.id}`
        : null,
      slides,
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

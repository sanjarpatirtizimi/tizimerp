import { Injectable, NotFoundException } from '@nestjs/common';
import { RecognitionEventStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FlagVisitDto } from './dto/flag-visit.dto';

const visitInclude = {
  driver: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      carPlate: true,
      photoUrl: true,
      status: true,
      telegramUsername: true,
    },
  },
  device: { select: { id: true, name: true } },
  flaggedBy: { select: { id: true, fullName: true } },
  transaction: { select: { id: true, amount: true, type: true } },
} as const;

@Injectable()
export class VisitsService {
  constructor(private readonly prisma: PrismaService) {}

  listRecent(take = 50, cursor?: string) {
    const limit = Math.min(Math.max(take, 1), 100);
    return this.prisma.recognitionEvent.findMany({
      where: {
        status: {
          in: [
            RecognitionEventStatus.PROCESSED,
            RecognitionEventStatus.IGNORED_COOLDOWN,
          ],
        },
        driverId: { not: null },
      },
      include: visitInclude,
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
  }

  listFlagged(take = 50, cursor?: string) {
    const limit = Math.min(Math.max(take, 1), 100);
    return this.prisma.recognitionEvent.findMany({
      where: { isRedFlagged: true },
      include: visitInclude,
      orderBy: { flaggedAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
  }

  async setFlag(id: string, dto: FlagVisitDto, staffUserId: string) {
    const existing = await this.prisma.recognitionEvent.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Visit not found');

    return this.prisma.recognitionEvent.update({
      where: { id },
      data: dto.isRedFlagged
        ? {
            isRedFlagged: true,
            flaggedAt: new Date(),
            flaggedById: staffUserId,
            flagNote: dto.flagNote?.trim() || null,
          }
        : {
            isRedFlagged: false,
            flaggedAt: null,
            flaggedById: null,
            flagNote: null,
          },
      include: visitInclude,
    });
  }
}

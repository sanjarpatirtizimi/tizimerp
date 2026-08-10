import { Injectable, NotFoundException } from '@nestjs/common';
import { FeedbackStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';

@Injectable()
export class FeedbackService {
  constructor(private readonly prisma: PrismaService) {}

  create(driverId: string, dto: CreateFeedbackDto) {
    return this.prisma.driverFeedback.create({
      data: {
        driverId,
        body: dto.body.trim(),
      },
      include: {
        driver: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            telegramUsername: true,
          },
        },
      },
    });
  }

  listForStaff(status?: FeedbackStatus, take = 50) {
    const limit = Math.min(Math.max(take, 1), 100);
    return this.prisma.driverFeedback.findMany({
      where: status ? { status } : undefined,
      include: {
        driver: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            carPlate: true,
            telegramUsername: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async update(id: string, dto: UpdateFeedbackDto) {
    const existing = await this.prisma.driverFeedback.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Feedback not found');

    return this.prisma.driverFeedback.update({
      where: { id },
      data: {
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.staffNote !== undefined
          ? { staffNote: dto.staffNote.trim() || null }
          : {}),
      },
      include: {
        driver: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            telegramUsername: true,
          },
        },
      },
    });
  }
}

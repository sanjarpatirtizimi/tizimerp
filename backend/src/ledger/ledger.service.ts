import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DriverStatus,
  Prisma,
  StampRedeemKind,
  TransactionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface DriverBalanceSummary {
  driverId: string;
  balance: string;
  totalStampPoints: string;
  totalCashAdvances: string;
  totalGoodsExchanged: string;
  availableStampCount: number;
}

const REDEEM_KIND_LABEL: Record<StampRedeemKind, string> = {
  CASH: 'pulga',
  GOODS: 'mahsulotga',
  OTHER: 'boshqa',
};

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 100;

/**
 * The Ledger is the single source of truth for money movement.
 *
 * Amounts are append-only: never change `amount`/`type` after insert.
 * Exception: STAMP rows may get redemption metadata (`redeemedAt`…) for UI;
 * the balance decrease is a separate STAMP_REDEMPTION insert.
 */
@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ---------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------

  async getBalance(driverId: string): Promise<Prisma.Decimal> {
    const result = await this.prisma.transaction.aggregate({
      where: { driverId },
      _sum: { amount: true },
    });
    return result._sum.amount ?? new Prisma.Decimal(0);
  }

  async getDriverSummary(driverId: string): Promise<DriverBalanceSummary> {
    await this.assertDriverExists(driverId);

    const [balanceAgg, stampAgg, cashAdvanceAgg, goodsAgg, availableStampCount] =
      await Promise.all([
        this.prisma.transaction.aggregate({
          where: { driverId },
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: { driverId, type: TransactionType.STAMP },
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: { driverId, type: TransactionType.CASH_ADVANCE },
          _sum: { amount: true },
        }),
        this.prisma.transaction.aggregate({
          where: { driverId, type: TransactionType.GOODS_EXCHANGE },
          _sum: { amount: true },
        }),
        this.prisma.transaction.count({
          where: {
            driverId,
            type: TransactionType.STAMP,
            redeemedAt: null,
          },
        }),
      ]);

    return {
      driverId,
      balance: (balanceAgg._sum.amount ?? new Prisma.Decimal(0)).toString(),
      totalStampPoints: (
        stampAgg._sum.amount ?? new Prisma.Decimal(0)
      ).toString(),
      totalCashAdvances: (cashAdvanceAgg._sum.amount ?? new Prisma.Decimal(0))
        .abs()
        .toString(),
      totalGoodsExchanged: (goodsAgg._sum.amount ?? new Prisma.Decimal(0))
        .abs()
        .toString(),
      availableStampCount,
    };
  }

  async listTransactions(
    driverId: string,
    page = 1,
    pageSize = PAGE_SIZE_DEFAULT,
  ) {
    await this.assertDriverExists(driverId);
    const take = Math.min(pageSize, PAGE_SIZE_MAX);
    const skip = (Math.max(page, 1) - 1) * take;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where: { driverId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          operator: { select: { id: true, fullName: true } },
          device: { select: { id: true, name: true } },
          product: { select: { id: true, name: true } },
          redeemedBy: { select: { id: true, fullName: true } },
          recognitionEvent: {
            select: {
              id: true,
              isRedFlagged: true,
              flagNote: true,
              flaggedAt: true,
              flaggedBy: { select: { id: true, fullName: true } },
            },
          },
        },
      }),
      this.prisma.transaction.count({ where: { driverId } }),
    ]);

    return { items, total, page: Math.max(page, 1), pageSize: take };
  }

  // ---------------------------------------------------------------------
  // Writes — every one of these is a pure INSERT into `transactions`.
  // ---------------------------------------------------------------------

  async issueCashAdvance(params: {
    driverId: string;
    operatorId: string;
    amount: number;
    description?: string;
  }) {
    const driver = await this.assertDriverExists(params.driverId);
    if (driver.status === DriverStatus.BLOCKED) {
      throw new BadRequestException(
        'Cannot issue an advance to a blocked driver',
      );
    }
    if (params.amount <= 0) {
      throw new BadRequestException('Advance amount must be positive');
    }

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          driverId: params.driverId,
          operatorId: params.operatorId,
          type: TransactionType.CASH_ADVANCE,
          amount: new Prisma.Decimal(params.amount).neg(),
          description: params.description ?? 'Cash advance',
        },
      });

      await this.auditService.log(
        {
          userId: params.operatorId,
          action: 'CASH_ADVANCE_ISSUED',
          entityType: 'Transaction',
          entityId: transaction.id,
          metadata: { driverId: params.driverId, amount: params.amount },
        },
        tx,
      );

      return transaction;
    });
  }

  async exchangeGoods(params: {
    driverId: string;
    operatorId: string;
    productId: string;
    quantity: number;
    description?: string;
  }) {
    const quantity = params.quantity ?? 1;
    const driver = await this.assertDriverExists(params.driverId);
    if (driver.status === DriverStatus.BLOCKED) {
      throw new BadRequestException(
        'Cannot exchange goods for a blocked driver',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: params.productId },
      });
      if (!product || !product.isActive) {
        throw new NotFoundException('Product not found or inactive');
      }

      // Guard against overselling with a conditional decrement — if another
      // concurrent exchange already dropped stock below `quantity`, this
      // affects 0 rows and we abort instead of going negative.
      const stockUpdate = await tx.product.updateMany({
        where: { id: params.productId, stockQty: { gte: quantity } },
        data: { stockQty: { decrement: quantity } },
      });
      if (stockUpdate.count === 0) {
        throw new ConflictException('Not enough stock for this exchange');
      }

      const totalAmount = product.unitPrice.mul(quantity);
      const transaction = await tx.transaction.create({
        data: {
          driverId: params.driverId,
          operatorId: params.operatorId,
          productId: params.productId,
          type: TransactionType.GOODS_EXCHANGE,
          amount: totalAmount.neg(),
          description: params.description ?? `${quantity} x ${product.name}`,
          metadata: { quantity, unitPrice: product.unitPrice.toString() },
        },
      });

      await this.auditService.log(
        {
          userId: params.operatorId,
          action: 'GOODS_EXCHANGE_ISSUED',
          entityType: 'Transaction',
          entityId: transaction.id,
          metadata: {
            driverId: params.driverId,
            productId: params.productId,
            quantity,
          },
        },
        tx,
      );

      return transaction;
    });
  }

  async manualAdjustment(params: {
    driverId: string;
    adminId: string;
    amount: number;
    reason: string;
  }) {
    await this.assertDriverExists(params.driverId);
    if (params.amount === 0) {
      throw new BadRequestException('Adjustment amount cannot be zero');
    }

    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.create({
        data: {
          driverId: params.driverId,
          operatorId: params.adminId,
          type: TransactionType.MANUAL_ADJUSTMENT,
          amount: new Prisma.Decimal(params.amount),
          description: params.reason,
        },
      });

      await this.auditService.log(
        {
          userId: params.adminId,
          action: 'MANUAL_ADJUSTMENT',
          entityType: 'Transaction',
          entityId: transaction.id,
          metadata: {
            driverId: params.driverId,
            amount: params.amount,
            reason: params.reason,
          },
        },
        tx,
      );

      return transaction;
    });
  }

  /**
   * Redeem N oldest unredeemed STAMP rows (FIFO): mark them redeemed for UI,
   * then INSERT a STAMP_REDEMPTION so SUM(amount) / balance decreases.
   */
  async redeemStamps(params: {
    driverId: string;
    operatorId: string;
    count: number;
    kind: StampRedeemKind;
    note?: string;
  }) {
    const driver = await this.assertDriverExists(params.driverId);
    if (driver.status === DriverStatus.BLOCKED) {
      throw new BadRequestException(
        'Bloklangan haydovchidan pechat yechib bo‘lmaydi',
      );
    }
    if (!Number.isInteger(params.count) || params.count < 1) {
      throw new BadRequestException('Pechat soni 1 yoki undan katta bo‘lishi kerak');
    }

    return this.prisma.$transaction(async (tx) => {
      const stamps = await tx.transaction.findMany({
        where: {
          driverId: params.driverId,
          type: TransactionType.STAMP,
          redeemedAt: null,
        },
        orderBy: { createdAt: 'asc' },
        take: params.count,
        select: { id: true, amount: true },
      });

      if (stamps.length < params.count) {
        throw new BadRequestException(
          `Yetarli pechat yo‘q. Mavjud: ${stamps.length}, so‘ralgan: ${params.count}`,
        );
      }

      const stampIds = stamps.map((s) => s.id);
      const total = stamps.reduce(
        (sum, s) => sum.add(s.amount),
        new Prisma.Decimal(0),
      );
      const now = new Date();
      const note = params.note?.trim() || undefined;
      const kindLabel = REDEEM_KIND_LABEL[params.kind];
      const description =
        note ??
        `${params.count} ta pechat yechildi (${kindLabel})`;

      const marked = await tx.transaction.updateMany({
        where: {
          id: { in: stampIds },
          type: TransactionType.STAMP,
          redeemedAt: null,
        },
        data: {
          redeemedAt: now,
          redeemedById: params.operatorId,
          redeemKind: params.kind,
          redeemNote: note ?? null,
        },
      });

      if (marked.count !== stampIds.length) {
        throw new ConflictException(
          'Pechatlar boshqa operatsiya bilan band. Qayta urinib ko‘ring',
        );
      }

      const redemption = await tx.transaction.create({
        data: {
          driverId: params.driverId,
          operatorId: params.operatorId,
          type: TransactionType.STAMP_REDEMPTION,
          amount: total.neg(),
          description,
          metadata: {
            stampIds,
            count: params.count,
            kind: params.kind,
            note: note ?? null,
          },
        },
      });

      await this.auditService.log(
        {
          userId: params.operatorId,
          action: 'STAMPS_REDEEMED',
          entityType: 'Transaction',
          entityId: redemption.id,
          metadata: {
            driverId: params.driverId,
            count: params.count,
            kind: params.kind,
            amount: total.toString(),
            stampIds,
          },
        },
        tx,
      );

      return redemption;
    });
  }

  private async assertDriverExists(driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    return driver;
  }
}

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DriverStatus, Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

export interface DriverBalanceSummary {
  driverId: string;
  balance: string;
  totalStampPoints: string;
  totalCashAdvances: string;
  totalGoodsExchanged: string;
}

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 100;

/**
 * The Ledger is the single source of truth for money movement.
 *
 * HARD RULE: this service NEVER updates or deletes a Transaction row. Every
 * method here only ever INSERTs new, immutable ledger entries. A driver's
 * balance is always derived with SUM(amount) — see `getBalance`.
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

    const [balanceAgg, stampAgg, cashAdvanceAgg, goodsAgg] = await Promise.all([
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

  private async assertDriverExists(driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    return driver;
  }
}

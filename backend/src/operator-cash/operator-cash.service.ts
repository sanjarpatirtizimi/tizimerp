import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OperatorCashEntryType,
  Prisma,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

type Tx = Prisma.TransactionClient;

const PAGE_SIZE_DEFAULT = 30;
const PAGE_SIZE_MAX = 100;

@Injectable()
export class OperatorCashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getBalance(operatorId: string, tx: Tx | PrismaService = this.prisma) {
    const result = await tx.operatorCashEntry.aggregate({
      where: { operatorId },
      _sum: { amount: true },
    });
    return result._sum.amount ?? new Prisma.Decimal(0);
  }

  async getMySummary(operatorId: string) {
    const balance = await this.getBalance(operatorId);
    return {
      operatorId,
      balance: balance.toString(),
    };
  }

  async listMyEntries(operatorId: string, page = 1, pageSize = PAGE_SIZE_DEFAULT) {
    const take = Math.min(pageSize, PAGE_SIZE_MAX);
    const skip = (Math.max(page, 1) - 1) * take;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.operatorCashEntry.findMany({
        where: { operatorId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          counterparty: {
            select: { id: true, fullName: true, phone: true, role: true },
          },
        },
      }),
      this.prisma.operatorCashEntry.count({ where: { operatorId } }),
    ]);

    return {
      items: items.map((e) => ({
        id: e.id,
        type: e.type,
        amount: e.amount.toString(),
        note: e.note,
        counterparty: e.counterparty,
        driverTransactionId: e.driverTransactionId,
        transferGroupId: e.transferGroupId,
        createdAt: e.createdAt,
      })),
      total,
      page: Math.max(page, 1),
      pageSize: take,
    };
  }

  /** Active staff peers for end-of-shift handoff (excludes self). */
  async listHandoffPeers(operatorId: string) {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        id: { not: operatorId },
        role: { in: [UserRole.OPERATOR, UserRole.SUPER_ADMIN] },
      },
      select: { id: true, fullName: true, phone: true, role: true },
      orderBy: { fullName: 'asc' },
    });
    return users;
  }

  /** Ertalab / smena boshida o'ziga pul o'tkazish. */
  async deposit(operatorId: string, amount: number, note?: string) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Miqdor 0 dan katta bo‘lishi kerak');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lockOperator(tx, operatorId);

      const entry = await tx.operatorCashEntry.create({
        data: {
          operatorId,
          type: OperatorCashEntryType.SHIFT_OPEN,
          amount: new Prisma.Decimal(amount),
          note: note?.trim() || 'Smena boshiga pul o‘tkazildi',
        },
      });

      const balance = await this.getBalance(operatorId, tx);

      await this.auditService.log(
        {
          userId: operatorId,
          action: 'OPERATOR_CASH_DEPOSIT',
          entityType: 'OperatorCashEntry',
          entityId: entry.id,
          metadata: { amount, balanceAfter: balance.toString() },
        },
        tx,
      );

      return {
        entryId: entry.id,
        amount: entry.amount.toString(),
        balance: balance.toString(),
      };
    });
  }

  /**
   * Smen tugatish: qolgan pulni boshqa operatorga to‘liq o‘tkazish.
   * confirmAmount serverdagi balans bilan aniq mos kelishi shart.
   */
  async endShift(
    fromOperatorId: string,
    toOperatorId: string,
    confirmAmount: number,
  ) {
    if (fromOperatorId === toOperatorId) {
      throw new BadRequestException('O‘zingizga o‘tkazib bo‘lmaydi');
    }
    if (!Number.isFinite(confirmAmount) || confirmAmount <= 0) {
      throw new BadRequestException('Tasdiqlash summasi noto‘g‘ri');
    }

    return this.prisma.$transaction(async (tx) => {
      // Deadlock oldini olish: ikkala lock tartibli.
      const lockOrder = [fromOperatorId, toOperatorId].sort();
      await this.lockOperator(tx, lockOrder[0]);
      await this.lockOperator(tx, lockOrder[1]);

      const toUser = await tx.user.findFirst({
        where: {
          id: toOperatorId,
          isActive: true,
          role: { in: [UserRole.OPERATOR, UserRole.SUPER_ADMIN] },
        },
        select: { id: true, fullName: true },
      });
      if (!toUser) {
        throw new NotFoundException('Qabul qiluvchi operator topilmadi yoki faol emas');
      }

      const balance = await this.getBalance(fromOperatorId, tx);
      if (balance.lte(0)) {
        throw new BadRequestException(
          'O‘tkazish uchun qolgan pul yo‘q. Avval o‘zingizga pul o‘tkazing yoki smena bo‘sh.',
        );
      }

      const confirm = new Prisma.Decimal(confirmAmount);
      if (!balance.eq(confirm)) {
        throw new BadRequestException(
          `Summa mos kelmadi. Hozirgi qoldiq: ${balance.toString()} UZS. Ekrandagi summani qayta tekshiring.`,
        );
      }

      const transferGroupId = randomUUID();
      const amountAbs = balance;

      const outEntry = await tx.operatorCashEntry.create({
        data: {
          operatorId: fromOperatorId,
          type: OperatorCashEntryType.SHIFT_TRANSFER_OUT,
          amount: amountAbs.neg(),
          counterpartyId: toOperatorId,
          transferGroupId,
          note: `Smen tugatish → ${toUser.fullName}`,
        },
      });

      const inEntry = await tx.operatorCashEntry.create({
        data: {
          operatorId: toOperatorId,
          type: OperatorCashEntryType.SHIFT_TRANSFER_IN,
          amount: amountAbs,
          counterpartyId: fromOperatorId,
          transferGroupId,
          note: `Smen qabul ← operator`,
        },
      });

      const fromAfter = await this.getBalance(fromOperatorId, tx);
      const toAfter = await this.getBalance(toOperatorId, tx);

      if (!fromAfter.eq(0)) {
        throw new BadRequestException(
          'Transfer xatosi: yuboruvchi balansi 0 bo‘lmadi. Bekor qilindi.',
        );
      }

      await this.auditService.log(
        {
          userId: fromOperatorId,
          action: 'OPERATOR_CASH_SHIFT_END',
          entityType: 'OperatorCashEntry',
          entityId: outEntry.id,
          metadata: {
            toOperatorId,
            toFullName: toUser.fullName,
            amount: amountAbs.toString(),
            transferGroupId,
            inEntryId: inEntry.id,
            fromBalanceAfter: fromAfter.toString(),
            toBalanceAfter: toAfter.toString(),
          },
        },
        tx,
      );

      return {
        transferGroupId,
        amount: amountAbs.toString(),
        toOperator: toUser,
        fromBalance: fromAfter.toString(),
        toBalance: toAfter.toString(),
      };
    });
  }

  /**
   * Haydovchiga avans / pechat-pul chiqimi — bir xil DB transaction ichida chaqiriladi.
   */
  async debitForDriverCashOut(
    tx: Tx,
    params: {
      operatorId: string;
      amount: Prisma.Decimal | number;
      type:
        | typeof OperatorCashEntryType.CASH_OUT_ADVANCE
        | typeof OperatorCashEntryType.CASH_OUT_STAMP;
      driverTransactionId: string;
      note?: string;
    },
  ) {
    const amount = new Prisma.Decimal(params.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('Chiqim summasi musbat bo‘lishi kerak');
    }

    await this.lockOperator(tx, params.operatorId);
    const balance = await this.getBalance(params.operatorId, tx);
    if (balance.lt(amount)) {
      throw new BadRequestException(
        `Operator puli yetarli emas. Qoldiq: ${balance.toString()} UZS, kerak: ${amount.toString()} UZS. Avval «Operator puli» orqali o‘zingizga pul o‘tkazing.`,
      );
    }

    await tx.operatorCashEntry.create({
      data: {
        operatorId: params.operatorId,
        type: params.type,
        amount: amount.neg(),
        driverTransactionId: params.driverTransactionId,
        note: params.note,
      },
    });
  }

  private async lockOperator(tx: Tx, operatorId: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`opcash:${operatorId}`}))`;
  }
}

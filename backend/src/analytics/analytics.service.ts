import { Injectable } from '@nestjs/common';
import {
  DriverStatus,
  Prisma,
  RecognitionEventStatus,
  TransactionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const RANKING_LIMIT = 15;

export interface AnalyticsDashboard {
  period: { from: string; to: string; label: string };
  monthly: {
    visitCount: number;
    totalStampPoints: string;
    totalCashAdvances: string;
    totalGoodsExchanged: string;
    netMovement: string;
    driversWhoVisited: number;
  };
  totals: {
    totalPositiveBalances: string;
    driversWithPositiveBalance: number;
    totalDebtAbs: string;
    driversWithDebt: number;
  };
  rankings: {
    mostDebt: DriverBalanceRow[];
    mostMoney: DriverBalanceRow[];
    mostVisits: DriverVisitRow[];
  };
  staffRankings: {
    mostAdvances: StaffAmountRow[];
    mostGoods: StaffAmountRow[];
  };
  inactiveDrivers: InactiveDriverRow[];
}

interface DriverBalanceRow {
  driverId: string;
  fullName: string;
  phone: string;
  carPlate: string | null;
  balance: string;
}

interface DriverVisitRow {
  driverId: string;
  fullName: string;
  phone: string;
  carPlate: string | null;
  visitCount: number;
  stampPoints: string;
}

interface StaffAmountRow {
  operatorId: string;
  fullName: string;
  phone: string;
  count: number;
  totalAmount: string;
}

interface InactiveDriverRow {
  driverId: string;
  fullName: string;
  phone: string;
  carPlate: string | null;
  lastVisitAt: string | null;
  daysSinceVisit: number | null;
  neverVisited: boolean;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(month?: string): Promise<AnalyticsDashboard> {
    const { from, to, label } = this.resolvePeriod(month);

    const [
      monthlyAggs,
      visitCount,
      driversWhoVisited,
      balanceRows,
      visitRows,
      advanceStaff,
      goodsStaff,
      inactiveDrivers,
    ] = await Promise.all([
      this.monthlyAggregates(from, to),
      this.prisma.transaction.count({
        where: {
          type: TransactionType.STAMP,
          createdAt: { gte: from, lt: to },
        },
      }),
      this.prisma.transaction.groupBy({
        by: ['driverId'],
        where: {
          type: TransactionType.STAMP,
          createdAt: { gte: from, lt: to },
        },
      }),
      this.driverBalances(),
      this.driverVisitsInPeriod(from, to),
      this.staffRanking(TransactionType.CASH_ADVANCE, from, to),
      this.staffRanking(TransactionType.GOODS_EXCHANGE, from, to),
      this.inactiveDriverRanking(),
    ]);

    const positive = balanceRows.filter((r) => r.balance.gt(0));
    const debt = balanceRows.filter((r) => r.balance.lt(0));

    const totalPositive = positive.reduce(
      (sum, r) => sum.add(r.balance),
      new Prisma.Decimal(0),
    );
    const totalDebtAbs = debt.reduce(
      (sum, r) => sum.add(r.balance.abs()),
      new Prisma.Decimal(0),
    );

    const driverMap = await this.driverMap(
      balanceRows.map((r) => r.driverId),
    );

    const mostDebt = [...debt]
      .sort((a, b) => a.balance.comparedTo(b.balance))
      .slice(0, RANKING_LIMIT)
      .map((r) => this.toBalanceRow(r, driverMap));

    const mostMoney = [...positive]
      .sort((a, b) => b.balance.comparedTo(a.balance))
      .slice(0, RANKING_LIMIT)
      .map((r) => this.toBalanceRow(r, driverMap));

    return {
      period: { from: from.toISOString(), to: to.toISOString(), label },
      monthly: {
        visitCount,
        totalStampPoints: monthlyAggs.stamp.toString(),
        totalCashAdvances: monthlyAggs.cash.abs().toString(),
        totalGoodsExchanged: monthlyAggs.goods.abs().toString(),
        netMovement: monthlyAggs.net.toString(),
        driversWhoVisited: driversWhoVisited.length,
      },
      totals: {
        totalPositiveBalances: totalPositive.toString(),
        driversWithPositiveBalance: positive.length,
        totalDebtAbs: totalDebtAbs.toString(),
        driversWithDebt: debt.length,
      },
      rankings: {
        mostDebt,
        mostMoney,
        mostVisits: visitRows,
      },
      staffRankings: {
        mostAdvances: advanceStaff,
        mostGoods: goodsStaff,
      },
      inactiveDrivers,
    };
  }

  private resolvePeriod(month?: string): {
    from: Date;
    to: Date;
    label: string;
  } {
    const now = new Date();
    let year = now.getUTCFullYear();
    let monthNum = now.getUTCMonth() + 1;

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(Number);
      year = y;
      monthNum = m;
    }

    // Uzbekistan business day boundary (UTC+5)
    const from = new Date(
      `${year}-${String(monthNum).padStart(2, '0')}-01T00:00:00+05:00`,
    );
    const nextMonth = monthNum === 12 ? 1 : monthNum + 1;
    const nextYear = monthNum === 12 ? year + 1 : year;
    const to = new Date(
      `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+05:00`,
    );

    return {
      from,
      to,
      label: `${year}-${String(monthNum).padStart(2, '0')}`,
    };
  }

  private async monthlyAggregates(from: Date, to: Date) {
    const [stamp, cash, goods, net] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          type: TransactionType.STAMP,
          createdAt: { gte: from, lt: to },
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          type: TransactionType.CASH_ADVANCE,
          createdAt: { gte: from, lt: to },
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          type: TransactionType.GOODS_EXCHANGE,
          createdAt: { gte: from, lt: to },
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { createdAt: { gte: from, lt: to } },
        _sum: { amount: true },
      }),
    ]);

    return {
      stamp: stamp._sum.amount ?? new Prisma.Decimal(0),
      cash: cash._sum.amount ?? new Prisma.Decimal(0),
      goods: goods._sum.amount ?? new Prisma.Decimal(0),
      net: net._sum.amount ?? new Prisma.Decimal(0),
    };
  }

  private async driverBalances(): Promise<
    Array<{ driverId: string; balance: Prisma.Decimal }>
  > {
    const activeDrivers = await this.prisma.driver.findMany({
      where: { status: DriverStatus.ACTIVE },
      select: { id: true },
    });
    const activeIds = activeDrivers.map((d) => d.id);
    if (activeIds.length === 0) return [];

    const rows = await this.prisma.transaction.groupBy({
      by: ['driverId'],
      where: { driverId: { in: activeIds } },
      _sum: { amount: true },
    });

    return rows.map((r) => ({
      driverId: r.driverId,
      balance: r._sum.amount ?? new Prisma.Decimal(0),
    }));
  }

  private async driverVisitsInPeriod(
    from: Date,
    to: Date,
  ): Promise<DriverVisitRow[]> {
    const grouped = await this.prisma.transaction.groupBy({
      by: ['driverId'],
      where: {
        type: TransactionType.STAMP,
        createdAt: { gte: from, lt: to },
      },
      _count: { _all: true },
      _sum: { amount: true },
      orderBy: { _count: { driverId: 'desc' } },
      take: RANKING_LIMIT,
    });

    if (grouped.length === 0) return [];

    const drivers = await this.driverMap(grouped.map((g) => g.driverId));

    return grouped.map((g) => {
      const d = drivers.get(g.driverId);
      return {
        driverId: g.driverId,
        fullName: d?.fullName ?? '—',
        phone: d?.phone ?? '—',
        carPlate: d?.carPlate ?? null,
        visitCount: g._count._all,
        stampPoints: (g._sum.amount ?? new Prisma.Decimal(0)).toString(),
      };
    });
  }

  private async staffRanking(
    type: TransactionType,
    from: Date,
    to: Date,
  ): Promise<StaffAmountRow[]> {
    const grouped = await this.prisma.transaction.groupBy({
      by: ['operatorId'],
      where: {
        type,
        operatorId: { not: null },
        createdAt: { gte: from, lt: to },
      },
      _count: { _all: true },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'asc' } }, // more negative = more issued
      take: RANKING_LIMIT,
    });

    const operatorIds = grouped
      .map((g) => g.operatorId)
      .filter((id): id is string => Boolean(id));

    if (operatorIds.length === 0) return [];

    const users = await this.prisma.user.findMany({
      where: { id: { in: operatorIds } },
      select: { id: true, fullName: true, phone: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return grouped
      .filter((g): g is typeof g & { operatorId: string } =>
        Boolean(g.operatorId),
      )
      .map((g) => {
        const u = userMap.get(g.operatorId);
        return {
          operatorId: g.operatorId,
          fullName: u?.fullName ?? '—',
          phone: u?.phone ?? '—',
          count: g._count._all,
          totalAmount: (g._sum.amount ?? new Prisma.Decimal(0))
            .abs()
            .toString(),
        };
      })
      .sort(
        (a, b) =>
          parseFloat(b.totalAmount) - parseFloat(a.totalAmount) ||
          b.count - a.count,
      );
  }

  private async inactiveDriverRanking(): Promise<InactiveDriverRow[]> {
    const drivers = await this.prisma.driver.findMany({
      where: { status: DriverStatus.ACTIVE },
      select: {
        id: true,
        fullName: true,
        phone: true,
        carPlate: true,
        createdAt: true,
      },
      orderBy: { fullName: 'asc' },
    });

    if (drivers.length === 0) return [];

    const lastVisits = await this.prisma.recognitionEvent.groupBy({
      by: ['driverId'],
      where: {
        driverId: { not: null },
        status: {
          in: [
            RecognitionEventStatus.PROCESSED,
            RecognitionEventStatus.IGNORED_COOLDOWN,
          ],
        },
      },
      _max: { createdAt: true },
    });

    const lastMap = new Map(
      lastVisits
        .filter((v): v is typeof v & { driverId: string } => Boolean(v.driverId))
        .map((v) => [v.driverId, v._max.createdAt]),
    );

    const now = Date.now();
    const rows: InactiveDriverRow[] = drivers.map((d) => {
      const last = lastMap.get(d.id) ?? null;
      if (!last) {
        const daysSinceCreated = Math.floor(
          (now - d.createdAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        return {
          driverId: d.id,
          fullName: d.fullName,
          phone: d.phone,
          carPlate: d.carPlate,
          lastVisitAt: null,
          daysSinceVisit: daysSinceCreated,
          neverVisited: true,
        };
      }

      const daysSinceVisit = Math.floor(
        (now - last.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        driverId: d.id,
        fullName: d.fullName,
        phone: d.phone,
        carPlate: d.carPlate,
        lastVisitAt: last.toISOString(),
        daysSinceVisit,
        neverVisited: false,
      };
    });

    // Only show drivers away 7+ days (or never visited), sorted by longest absence
    return rows
      .filter((r) => (r.daysSinceVisit ?? 0) >= 7 || r.neverVisited)
      .sort((a, b) => (b.daysSinceVisit ?? 0) - (a.daysSinceVisit ?? 0))
      .slice(0, 40);
  }

  private async driverMap(ids: string[]) {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();

    const drivers = await this.prisma.driver.findMany({
      where: { id: { in: unique } },
      select: {
        id: true,
        fullName: true,
        phone: true,
        carPlate: true,
      },
    });

    return new Map(drivers.map((d) => [d.id, d]));
  }

  private toBalanceRow(
    row: { driverId: string; balance: Prisma.Decimal },
    driverMap: Map<
      string,
      { fullName: string; phone: string; carPlate: string | null }
    >,
  ): DriverBalanceRow {
    const d = driverMap.get(row.driverId);
    return {
      driverId: row.driverId,
      fullName: d?.fullName ?? '—',
      phone: d?.phone ?? '—',
      carPlate: d?.carPlate ?? null,
      balance: row.balance.toString(),
    };
  }
}

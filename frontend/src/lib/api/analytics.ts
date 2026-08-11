import { apiClient } from "../api-client";

export interface DriverBalanceRow {
  driverId: string;
  fullName: string;
  phone: string;
  carPlate: string | null;
  balance: string;
}

export interface DriverVisitRow {
  driverId: string;
  fullName: string;
  phone: string;
  carPlate: string | null;
  visitCount: number;
  stampPoints: string;
}

export interface StaffAmountRow {
  operatorId: string;
  fullName: string;
  phone: string;
  count: number;
  totalAmount: string;
}

export interface InactiveDriverRow {
  driverId: string;
  fullName: string;
  phone: string;
  carPlate: string | null;
  lastVisitAt: string | null;
  daysSinceVisit: number | null;
  neverVisited: boolean;
}

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

export interface DailyVisitRow {
  id: string;
  driverId: string;
  fullName: string;
  phone: string;
  carPlate: string | null;
  amount: string;
  createdAt: string;
}

export interface DailyAnalyticsReport {
  period: { from: string; to: string; label: string; date: string };
  summary: {
    stampCount: number;
    stampPoints: string;
    cashAdvances: string;
    cashAdvanceCount: number;
    goodsExchanged: string;
    goodsCount: number;
    stampRedemptions: string;
    stampRedemptionCount: number;
    driversWhoVisited: number;
  };
  visits: DailyVisitRow[];
}

export const analyticsApi = {
  dashboard: (month?: string) =>
    apiClient
      .get<AnalyticsDashboard>("/analytics/dashboard", {
        params: month ? { month } : undefined,
      })
      .then((r) => r.data),

  daily: (date?: string) =>
    apiClient
      .get<DailyAnalyticsReport>("/analytics/daily", {
        params: date ? { date } : undefined,
      })
      .then((r) => r.data),
};

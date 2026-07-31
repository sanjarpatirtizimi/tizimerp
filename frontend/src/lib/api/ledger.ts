import { apiClient } from "../api-client";
import type { DriverBalanceSummary, PaginatedTransactions } from "../types";

export const ledgerApi = {
  getDriverBalance: (driverId: string) =>
    apiClient.get<DriverBalanceSummary>(`/drivers/${driverId}/balance`).then((r) => r.data),

  getDriverTransactions: (driverId: string, page = 1, pageSize = 20) =>
    apiClient
      .get<PaginatedTransactions>(`/drivers/${driverId}/transactions`, {
        params: { page, pageSize },
      })
      .then((r) => r.data),

  issueCashAdvance: (driverId: string, amount: number, description?: string) =>
    apiClient
      .post(`/drivers/${driverId}/cash-advances`, { amount, description })
      .then((r) => r.data),

  exchangeGoods: (
    driverId: string,
    productId: string,
    quantity: number,
    description?: string,
  ) =>
    apiClient
      .post(`/drivers/${driverId}/goods-exchanges`, { productId, quantity, description })
      .then((r) => r.data),

  manualAdjustment: (driverId: string, amount: number, reason: string) =>
    apiClient.post(`/drivers/${driverId}/adjustments`, { amount, reason }).then((r) => r.data),

  // Driver self-service
  getMyBalance: () => apiClient.get<DriverBalanceSummary>("/me/balance").then((r) => r.data),

  getMyTransactions: (page = 1, pageSize = 20) =>
    apiClient
      .get<PaginatedTransactions>("/me/transactions", { params: { page, pageSize } })
      .then((r) => r.data),
};

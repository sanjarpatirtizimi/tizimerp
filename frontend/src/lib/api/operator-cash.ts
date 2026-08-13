import { apiClient } from "@/lib/api-client";

export type OperatorCashEntryType =
  | "SHIFT_OPEN"
  | "CASH_OUT_ADVANCE"
  | "CASH_OUT_STAMP"
  | "SHIFT_TRANSFER_OUT"
  | "SHIFT_TRANSFER_IN";

export type OperatorCashPeer = {
  id: string;
  fullName: string;
  phone: string;
  role: string;
};

export type OperatorCashEntry = {
  id: string;
  type: OperatorCashEntryType;
  amount: string;
  note: string | null;
  counterparty: OperatorCashPeer | null;
  driverTransactionId: string | null;
  transferGroupId: string | null;
  createdAt: string;
};

export const operatorCashApi = {
  getMySummary: () =>
    apiClient
      .get<{ operatorId: string; balance: string }>("/operator-cash/me")
      .then((r) => r.data),

  listEntries: (page = 1) =>
    apiClient
      .get<{
        items: OperatorCashEntry[];
        total: number;
        page: number;
        pageSize: number;
      }>("/operator-cash/me/entries", { params: { page } })
      .then((r) => r.data),

  listPeers: () =>
    apiClient
      .get<OperatorCashPeer[]>("/operator-cash/peers")
      .then((r) => r.data),

  deposit: (amount: number, note?: string) =>
    apiClient
      .post<{ entryId: string; amount: string; balance: string }>(
        "/operator-cash/deposit",
        { amount, note },
      )
      .then((r) => r.data),

  endShift: (toOperatorId: string, confirmAmount: number) =>
    apiClient
      .post<{
        transferGroupId: string;
        amount: string;
        toOperator: { id: string; fullName: string };
        fromBalance: string;
        toBalance: string;
      }>("/operator-cash/end-shift", { toOperatorId, confirmAmount })
      .then((r) => r.data),
};

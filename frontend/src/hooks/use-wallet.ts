"use client";

import { useCallback, useEffect, useState } from "react";
import { ledgerApi } from "@/lib/api/ledger";
import type { DriverBalanceSummary, Transaction } from "@/lib/types";

const PAGE_SIZE = 20;

/**
 * Shared wallet-fetching logic for both the Driver's own dashboard ("me")
 * and the staff-facing driver detail page (by driverId).
 */
export function useWallet(driverId?: string) {
  const [summary, setSummary] = useState<DriverBalanceSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const loadSummary = useCallback(async () => {
    const data = driverId
      ? await ledgerApi.getDriverBalance(driverId)
      : await ledgerApi.getMyBalance();
    setSummary(data);
  }, [driverId]);

  const loadTransactions = useCallback(
    async (nextPage: number, replace: boolean) => {
      const data = driverId
        ? await ledgerApi.getDriverTransactions(driverId, nextPage, PAGE_SIZE)
        : await ledgerApi.getMyTransactions(nextPage, PAGE_SIZE);
      setTransactions((prev) => (replace ? data.items : [...prev, ...data.items]));
      setTotal(data.total);
      setPage(data.page);
    },
    [driverId],
  );

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadSummary(), loadTransactions(1, true)]);
    } finally {
      setIsLoading(false);
    }
  }, [loadSummary, loadTransactions]);

  useEffect(() => {
    // Data fetch on mount / when the target driver changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  async function loadMore() {
    setIsLoadingMore(true);
    try {
      await loadTransactions(page + 1, false);
    } finally {
      setIsLoadingMore(false);
    }
  }

  return {
    summary,
    transactions,
    isLoading,
    isLoadingMore,
    hasMore: transactions.length < total,
    loadMore,
    refresh,
  };
}

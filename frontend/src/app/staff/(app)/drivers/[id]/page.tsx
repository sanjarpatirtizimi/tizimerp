"use client";

import { use, useEffect, useState } from "react";
import { Car, Loader2, Phone } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BalanceCard } from "@/components/wallet/balance-card";
import { TransactionList } from "@/components/wallet/transaction-list";
import { CashAdvanceDialog } from "@/components/drivers/cash-advance-dialog";
import { GoodsExchangeDialog } from "@/components/drivers/goods-exchange-dialog";
import { ManualAdjustmentDialog } from "@/components/drivers/manual-adjustment-dialog";
import { ManualFaceMappingDialog } from "@/components/drivers/manual-face-mapping-dialog";
import { useWallet } from "@/hooks/use-wallet";
import { useAuth } from "@/lib/auth-context";
import { driversApi } from "@/lib/api/drivers";
import { API_URL } from "@/lib/api-client";
import { driverStatusLabels, initials } from "@/lib/format";
import type { Driver, DriverStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusStyles: Record<DriverStatus, string> = {
  ACTIVE: "bg-success/15 text-success",
  PENDING: "bg-amber-500/15 text-amber-600",
  BLOCKED: "bg-destructive/15 text-destructive",
};

const backendOrigin = API_URL.replace(/\/api\/?$/, "");

export default function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { claims } = useAuth();
  const isSuperAdmin = claims?.kind === "staff" && claims.role === "SUPER_ADMIN";

  const [driver, setDriver] = useState<Driver | null>(null);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const { summary, transactions, isLoading, isLoadingMore, hasMore, loadMore, refresh } =
    useWallet(id);

  async function loadDriver() {
    const data = await driversApi.get(id);
    setDriver(data);
  }

  useEffect(() => {
    // Data fetch on mount / when the target driver changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDriver();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function toggleBlocked() {
    if (!driver) return;
    setIsStatusUpdating(true);
    try {
      const nextStatus: DriverStatus = driver.status === "BLOCKED" ? "ACTIVE" : "BLOCKED";
      const updated = await driversApi.setStatus(id, nextStatus);
      setDriver((prev) => (prev ? { ...prev, status: updated.status } : prev));
    } finally {
      setIsStatusUpdating(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      {!driver ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : (
        <Card>
          <CardContent className="flex items-center gap-4 py-2">
            <Avatar className="size-14">
              {driver.photoUrl && (
                <AvatarImage src={`${backendOrigin}${driver.photoUrl}`} alt={driver.fullName} />
              )}
              <AvatarFallback>{initials(driver.fullName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{driver.fullName}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Phone className="size-3" />
                  {driver.phone}
                </span>
                {driver.carPlate && (
                  <span className="flex items-center gap-1">
                    <Car className="size-3" />
                    {driver.carPlate}
                  </span>
                )}
              </div>
            </div>
            <Badge className={cn(statusStyles[driver.status])} variant="outline">
              {driverStatusLabels[driver.status]}
            </Badge>
          </CardContent>
        </Card>
      )}

      {isLoading || !summary ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        <BalanceCard summary={summary} />
      )}

      <div className="flex gap-2">
        <CashAdvanceDialog driverId={id} onSuccess={refresh} />
        <GoodsExchangeDialog driverId={id} onSuccess={refresh} />
      </div>

      {driver && (
        <ManualFaceMappingDialog driverId={id} onSuccess={loadDriver} />
      )}

      {isSuperAdmin && driver && (
        <div className="flex items-center justify-between">
          <ManualAdjustmentDialog driverId={id} onSuccess={refresh} />
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={toggleBlocked}
            disabled={isStatusUpdating}
          >
            {isStatusUpdating && <Loader2 className="animate-spin" />}
            {driver.status === "BLOCKED" ? "Blokdan chiqarish" : "Haydovchini bloklash"}
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tranzaksiyalar tarixi</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <>
              <TransactionList transactions={transactions} />
              {hasMore && (
                <Button
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore && <Loader2 className="animate-spin" />}
                  Ko&apos;proq yuklash
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

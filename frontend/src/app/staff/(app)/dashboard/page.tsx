"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Search, Phone, Car, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateOperatorDialog } from "@/components/users/create-operator-dialog";
import { useAuth } from "@/lib/auth-context";
import { driversApi } from "@/lib/api/drivers";
import { getApiErrorMessage } from "@/lib/api-client";
import { driverStatusLabels } from "@/lib/format";
import type { Driver, DriverStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusStyles: Record<DriverStatus, string> = {
  ACTIVE: "bg-success/15 text-success",
  PENDING: "bg-amber-500/15 text-amber-600",
  BLOCKED: "bg-destructive/15 text-destructive",
};

export default function StaffDashboardPage() {
  const { claims } = useAuth();
  const isSuperAdmin = claims?.kind === "staff" && claims.role === "SUPER_ADMIN";
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [query, setQuery] = useState("");

  const loadDrivers = useCallback(
    () => driversApi.list().then(setDrivers),
    [],
  );

  useEffect(() => {
    loadDrivers().finally(() => setIsLoading(false));
  }, [loadDrivers]);

  async function handleReconnect() {
    setIsReconnecting(true);
    try {
      const result = await driversApi.reconnectPending();
      if (result.drivers === 0) {
        toast.info("Qayta ulashga kutayotgan haydovchi yo'q");
      } else {
        const extra = result.skipped
          ? ` (${result.skipped} ta rasm yo'qligi sababli o'tkazib yuborildi)`
          : "";
        toast.success(
          `${result.drivers} ta haydovchi qurilmaga qayta ulashga yuborildi${extra}`,
        );
      }
      await loadDrivers();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Qayta ulab bo'lmadi"));
    } finally {
      setIsReconnecting(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter(
      (d) =>
        d.fullName.toLowerCase().includes(q) ||
        d.phone.includes(q) ||
        (d.carPlate ?? "").toLowerCase().includes(q),
    );
  }, [drivers, query]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="text-lg font-semibold">Haydovchilar</h1>
          {!isLoading && (
            <span className="text-sm font-medium tabular-nums text-muted-foreground">
              {query.trim()
                ? `${filtered.length} / ${drivers.length} ta`
                : `${drivers.length} ta`}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin && <CreateOperatorDialog />}
          <Button
            size="sm"
            variant="outline"
            disabled={isReconnecting}
            onClick={handleReconnect}
          >
            {isReconnecting ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RefreshCw />
            )}
            Qayta ulash
          </Button>
          <Button asChild size="sm">
            <Link href="/staff/drivers/new">
              <Plus />
              Yangi haydovchi
            </Link>
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Ism, telefon yoki raqam bo'yicha qidirish"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Haydovchilar topilmadi.</p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((driver) => (
            <li key={driver.id}>
              <Link
                href={`/staff/drivers/${driver.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{driver.fullName}</p>
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
                <Badge className={cn("shrink-0", statusStyles[driver.status])} variant="outline">
                  {driverStatusLabels[driver.status]}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

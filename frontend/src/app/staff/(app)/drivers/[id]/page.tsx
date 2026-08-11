"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Car, Loader2, Phone, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BalanceCard } from "@/components/wallet/balance-card";
import { TransactionList } from "@/components/wallet/transaction-list";
import { CashAdvanceDialog } from "@/components/drivers/cash-advance-dialog";
import { GoodsExchangeDialog } from "@/components/drivers/goods-exchange-dialog";
import { ManualAdjustmentDialog } from "@/components/drivers/manual-adjustment-dialog";
import { RedeemStampsDialog } from "@/components/drivers/redeem-stamps-dialog";
import { DevicePairingPanel } from "@/components/drivers/device-pairing-panel";
import { DriverPhotoButton } from "@/components/drivers/driver-photo-button";
import { EditDriverDialog } from "@/components/drivers/edit-driver-dialog";
import { TelegramField } from "@/components/drivers/telegram-field";
import { useWallet } from "@/hooks/use-wallet";
import { useAuth } from "@/lib/auth-context";
import { getApiErrorMessage } from "@/lib/api-client";
import { driversApi } from "@/lib/api/drivers";
import { driverStatusLabels } from "@/lib/format";
import type { Driver, DriverStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const statusStyles: Record<DriverStatus, string> = {
  ACTIVE: "bg-success/15 text-success",
  PENDING: "bg-amber-500/15 text-amber-600",
  BLOCKED: "bg-destructive/15 text-destructive",
};

export default function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { claims } = useAuth();
  const isSuperAdmin = claims?.kind === "staff" && claims.role === "SUPER_ADMIN";
  const isStaff = claims?.kind === "staff";

  const [driver, setDriver] = useState<Driver | null>(null);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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

  async function handleDelete() {
    if (!driver) return;
    setIsDeleting(true);
    try {
      await driversApi.remove(id);
      toast.success("Haydovchi o'chirildi");
      router.push("/staff/dashboard");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Haydovchini o'chirib bo'lmadi"));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      {!driver ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : (
        <Card>
          <CardContent className="flex items-center gap-4 py-2">
            <DriverPhotoButton
              driver={driver}
              onUpdated={(updated) => setDriver(updated)}
            />
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
              <div className="mt-2">
                <EditDriverDialog
                  driver={driver}
                  onSuccess={async (updated) => {
                    setDriver(updated);
                    await loadDriver();
                  }}
                />
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

      <div className="flex flex-wrap gap-2">
        <CashAdvanceDialog driverId={id} onSuccess={refresh} />
        <GoodsExchangeDialog driverId={id} onSuccess={refresh} />
        <RedeemStampsDialog
          driverId={id}
          availableStampCount={summary?.availableStampCount ?? 0}
          onSuccess={refresh}
        />
      </div>

      {driver && <DevicePairingPanel driver={driver} onChanged={loadDriver} />}

      {driver && (
        <TelegramField
          driver={driver}
          onChanged={(updated) => setDriver(updated)}
        />
      )}

      {isSuperAdmin && driver && (
        <div className="flex items-center justify-between gap-2">
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

      {isStaff && driver && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Haydovchini o&apos;chirish
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Haydovchini o&apos;chirish?</AlertDialogTitle>
              <AlertDialogDescription>
                &quot;{driver.fullName}&quot; ro&apos;yxatdan olib tashlanadi va tizimga
                kira olmaydi. Balans/tranzaksiya tarixi saqlanadi. Telefon raqami
                keyin qayta ishlatilishi mumkin.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-white hover:bg-destructive/90"
                onClick={(e) => {
                  e.preventDefault();
                  void handleDelete();
                }}
                disabled={isDeleting}
              >
                O&apos;chirish
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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

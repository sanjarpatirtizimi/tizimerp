"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BalanceCard } from "@/components/wallet/balance-card";
import { TransactionList } from "@/components/wallet/transaction-list";
import { useWallet } from "@/hooks/use-wallet";
import { meApi } from "@/lib/api/me";
import type { Driver } from "@/lib/types";

export default function DriverDashboardPage() {
  const { summary, transactions, isLoading, isLoadingMore, hasMore, loadMore } = useWallet();
  const [profile, setProfile] = useState<Driver | null>(null);

  useEffect(() => {
    meApi.getProfile().then(setProfile).catch(() => undefined);
  }, []);

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      {profile && (
        <div>
          <h1 className="text-lg font-semibold">Salom, {profile.fullName.split(" ")[0]}</h1>
          {profile.carPlate && (
            <p className="text-sm text-muted-foreground">
              {profile.carPlate} {profile.carBrand ? `• ${profile.carBrand}` : ""}
            </p>
          )}
        </div>
      )}

      {isLoading || !summary ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        <BalanceCard summary={summary} />
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

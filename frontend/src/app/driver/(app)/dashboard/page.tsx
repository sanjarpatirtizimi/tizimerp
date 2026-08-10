"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { BalanceCard } from "@/components/wallet/balance-card";
import { TransactionList } from "@/components/wallet/transaction-list";
import { useWallet } from "@/hooks/use-wallet";
import { getApiErrorMessage } from "@/lib/api-client";
import { feedbackApi } from "@/lib/api/feedback";
import { meApi } from "@/lib/api/me";
import type { Driver } from "@/lib/types";

export default function DriverDashboardPage() {
  const { summary, transactions, isLoading, isLoadingMore, hasMore, loadMore } =
    useWallet();
  const [profile, setProfile] = useState<Driver | null>(null);
  const [telegram, setTelegram] = useState("");
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [feedbackBody, setFeedbackBody] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);

  useEffect(() => {
    meApi
      .getProfile()
      .then((data) => {
        setProfile(data);
        setTelegram(data.telegramUsername ?? "");
      })
      .catch(() => undefined);
  }, []);

  async function saveTelegram() {
    setSavingTelegram(true);
    try {
      const updated = await meApi.setTelegram(telegram.trim() || null);
      setProfile(updated);
      setTelegram(updated.telegramUsername ?? "");
      toast.success("Telegram saqlandi");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Saqlab bo'lmadi"));
    } finally {
      setSavingTelegram(false);
    }
  }

  async function sendFeedback() {
    if (!feedbackBody.trim()) {
      toast.error("Matn yozing");
      return;
    }
    setSendingFeedback(true);
    try {
      await feedbackApi.create(feedbackBody.trim());
      setFeedbackBody("");
      toast.success("Murojaat yuborildi");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Yuborib bo'lmadi"));
    } finally {
      setSendingFeedback(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      {profile && (
        <div>
          <h1 className="text-lg font-semibold">
            Salom, {profile.fullName.split(" ")[0]}
          </h1>
          {profile.carPlate && (
            <p className="text-sm text-muted-foreground">
              {profile.carPlate}{" "}
              {profile.carBrand ? `• ${profile.carBrand}` : ""}
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
          <CardTitle className="text-base">Telegram</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            value={telegram}
            onChange={(e) => setTelegram(e.target.value)}
            placeholder="@username yoki telefon"
          />
          <Button onClick={() => void saveTelegram()} disabled={savingTelegram}>
            {savingTelegram ? <Loader2 className="animate-spin" /> : "Saqlash"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Murojaat</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Fikr yoki e&apos;tirozingizni yozing — operator va admin ko&apos;radi.
          </p>
          <Textarea
            value={feedbackBody}
            onChange={(e) => setFeedbackBody(e.target.value)}
            placeholder="Matn..."
            rows={4}
          />
          <Button
            className="w-full"
            onClick={() => void sendFeedback()}
            disabled={sendingFeedback}
          >
            {sendingFeedback && <Loader2 className="animate-spin" />}
            Yuborish
          </Button>
        </CardContent>
      </Card>

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

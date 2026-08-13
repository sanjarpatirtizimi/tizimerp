"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Wallet } from "lucide-react";
import { RequireStaff } from "@/components/auth/route-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  operatorCashApi,
  type OperatorCashEntry,
  type OperatorCashEntryType,
  type OperatorCashPeer,
} from "@/lib/api/operator-cash";
import { formatDateTime, formatUzs } from "@/lib/format";

const TYPE_LABELS: Record<OperatorCashEntryType, string> = {
  SHIFT_OPEN: "Smena ochish (kirim)",
  CASH_OUT_ADVANCE: "Avans berildi",
  CASH_OUT_STAMP: "Pechat pulga",
  SHIFT_TRANSFER_OUT: "Smen yopish (chiqim)",
  SHIFT_TRANSFER_IN: "Smen qabul (kirim)",
};

function OperatorCashPageInner() {
  const [balance, setBalance] = useState<string>("0");
  const [entries, setEntries] = useState<OperatorCashEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [depositOpen, setDepositOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositBusy, setDepositBusy] = useState(false);

  const [endOpen, setEndOpen] = useState(false);
  const [peers, setPeers] = useState<OperatorCashPeer[]>([]);
  const [toOperatorId, setToOperatorId] = useState("");
  const [confirmAmount, setConfirmAmount] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [endBusy, setEndBusy] = useState(false);
  const [endStep, setEndStep] = useState<1 | 2>(1);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [summary, list] = await Promise.all([
        operatorCashApi.getMySummary(),
        operatorCashApi.listEntries(1),
      ]);
      setBalance(summary.balance);
      setEntries(list.items);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Operator pulini yuklab bo‘lmadi"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleDeposit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(depositAmount.replace(/\s/g, ""));
    if (!amount || amount <= 0) {
      toast.error("To‘g‘ri summani kiriting");
      return;
    }
    setDepositBusy(true);
    try {
      const result = await operatorCashApi.deposit(amount);
      toast.success(`Kassaga qo‘shildi: ${formatUzs(result.amount)}`);
      setDepositOpen(false);
      setDepositAmount("");
      await refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Pul o‘tkazib bo‘lmadi"));
    } finally {
      setDepositBusy(false);
    }
  }

  async function openEndShift() {
    setEndStep(1);
    setToOperatorId("");
    setConfirmAmount("");
    setConfirmName("");
    setEndOpen(true);
    try {
      const list = await operatorCashApi.listPeers();
      setPeers(list);
      if (list.length === 0) {
        toast.error("Boshqa faol operator topilmadi");
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Operatorlar ro‘yxati yuklanmadi"));
    }
  }

  const selectedPeer = peers.find((p) => p.id === toOperatorId);
  const balanceNum = parseFloat(balance) || 0;

  async function handleEndShift(e: React.FormEvent) {
    e.preventDefault();
    if (!toOperatorId || !selectedPeer) {
      toast.error("Qabul qiluvchi operatorni tanlang");
      return;
    }
    if (endStep === 1) {
      setConfirmAmount(balance);
      setConfirmName("");
      setEndStep(2);
      return;
    }

    const typed = Number(confirmAmount.replace(/\s/g, ""));
    if (!typed || Math.abs(typed - balanceNum) > 0.001) {
      toast.error(
        `Summa aniq mos kelishi kerak: ${formatUzs(balance)}. Qayta kiriting.`,
      );
      return;
    }
    if (confirmName.trim() !== selectedPeer.fullName.trim()) {
      toast.error(
        `Xavfsizlik: qabul qiluvchi ismini to‘liq yozing: «${selectedPeer.fullName}»`,
      );
      return;
    }

    setEndBusy(true);
    try {
      const result = await operatorCashApi.endShift(toOperatorId, typed);
      toast.success(
        `${formatUzs(result.amount)} → ${result.toOperator.fullName} ga o‘tkazildi`,
      );
      setEndOpen(false);
      await refresh();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Smen yopib bo‘lmadi"));
      await refresh();
    } finally {
      setEndBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold text-[var(--brand-crust)]">
            Operator puli
          </h1>
          <p className="text-sm text-muted-foreground">
            Smena kassasi — avans va pechat puli shu yerdan ayriladi
          </p>
        </div>
        <Wallet className="size-6 text-primary" />
      </div>

      <Card className="border-[var(--brand-gold)]/40 bg-[rgb(255_253_248_/_0.95)]">
        <CardContent className="space-y-3 py-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Hozirgi qoldiq
          </p>
          {loading ? (
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          ) : (
            <p className="font-display text-3xl font-semibold tabular-nums text-[var(--brand-crust)]">
              {formatUzs(balance)}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={() => setDepositOpen(true)}>
              O‘ziga pul o‘tkazish
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              disabled={loading || balanceNum <= 0}
              onClick={() => void openEndShift()}
            >
              Smen tugatish
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ertalab kassaga pul qo‘ying. Kun oxirida qolgan summani boshqa
            operatorga to‘liq o‘tkazing.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-medium">Harakatlar</h2>
        {loading && entries.length === 0 ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            Hali yozuv yo‘q
          </p>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => {
              const amt = parseFloat(entry.amount);
              const positive = amt >= 0;
              return (
                <li
                  key={entry.id}
                  className="rounded-xl border bg-card/80 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {TYPE_LABELS[entry.type]}
                      </p>
                      {entry.counterparty && (
                        <p className="truncate text-xs text-muted-foreground">
                          {entry.type === "SHIFT_TRANSFER_OUT" ? "→ " : "← "}
                          {entry.counterparty.fullName}
                        </p>
                      )}
                      {entry.note && (
                        <p className="truncate text-xs text-muted-foreground">
                          {entry.note}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        {formatDateTime(entry.createdAt)}
                      </p>
                    </div>
                    <p
                      className={
                        positive
                          ? "shrink-0 text-sm font-semibold text-emerald-700"
                          : "shrink-0 text-sm font-semibold text-red-700"
                      }
                    >
                      {positive ? "+" : ""}
                      {formatUzs(entry.amount)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent>
          <form onSubmit={handleDeposit}>
            <DialogHeader>
              <DialogTitle>O‘ziga pul o‘tkazish</DialogTitle>
              <DialogDescription>
                Smena boshida kassaga qo‘yiladigan summa. Keyin avans/pechat shu
                puldan ayriladi.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="deposit-amount">Miqdor (UZS)</Label>
              <Input
                id="deposit-amount"
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="20000000"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={depositBusy} className="w-full">
                {depositBusy && <Loader2 className="animate-spin" />}
                Kassaga qo‘shish
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={endOpen}
        onOpenChange={(open) => {
          setEndOpen(open);
          if (!open) setEndStep(1);
        }}
      >
        <DialogContent>
          <form onSubmit={handleEndShift}>
            <DialogHeader>
              <DialogTitle>Smen tugatish</DialogTitle>
              <DialogDescription>
                {endStep === 1
                  ? "Qolgan pulni qabul qiladigan operatorni tanlang. Summa to‘liq o‘tadi."
                  : "Adashmaslik uchun summa va ismni qayta tasdiqlang."}
              </DialogDescription>
            </DialogHeader>

            {endStep === 1 ? (
              <div className="space-y-4 py-4">
                <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
                  O‘tkaziladigan qoldiq:{" "}
                  <span className="font-semibold">{formatUzs(balance)}</span>
                </div>
                <div className="space-y-2">
                  <Label>Qabul qiluvchi operator</Label>
                  <Select value={toOperatorId} onValueChange={setToOperatorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Operatorni tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {peers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.fullName} · {p.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <div className="rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  <p>
                    <strong>{formatUzs(balance)}</strong> →{" "}
                    <strong>{selectedPeer?.fullName}</strong>
                  </p>
                  <p className="mt-1 text-xs">
                    Bu amal qaytarilmaydi. Sizning qoldingiz 0 bo‘ladi.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-amount">
                    Summani qayta kiriting (aniq)
                  </Label>
                  <Input
                    id="confirm-amount"
                    type="number"
                    inputMode="numeric"
                    value={confirmAmount}
                    onChange={(e) => setConfirmAmount(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-name">
                    Qabul qiluvchi ismini to‘liq yozing
                  </Label>
                  <Input
                    id="confirm-name"
                    placeholder={selectedPeer?.fullName}
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              {endStep === 2 && (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={endBusy}
                  onClick={() => setEndStep(1)}
                >
                  Orqaga
                </Button>
              )}
              <Button
                type="submit"
                disabled={endBusy || (endStep === 1 && !toOperatorId)}
                className="w-full sm:w-auto"
              >
                {endBusy && <Loader2 className="animate-spin" />}
                {endStep === 1 ? "Davom etish" : "Tasdiqlab o‘tkazish"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function OperatorCashPage() {
  return (
    <RequireStaff roles={["SUPER_ADMIN", "OPERATOR"]}>
      <OperatorCashPageInner />
    </RequireStaff>
  );
}

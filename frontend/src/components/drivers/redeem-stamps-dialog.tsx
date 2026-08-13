"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api-client";
import { ledgerApi } from "@/lib/api/ledger";
import { operatorCashApi } from "@/lib/api/operator-cash";
import { formatUzs } from "@/lib/format";
import type { StampRedeemKind } from "@/lib/types";

const KIND_OPTIONS: { value: StampRedeemKind; label: string }[] = [
  { value: "CASH", label: "Pulga" },
  { value: "GOODS", label: "Mahsulotga / bronga" },
  { value: "OTHER", label: "Boshqa" },
];

const STAMP_UNIT = 30000;

export function RedeemStampsDialog({
  driverId,
  availableStampCount,
  onSuccess,
}: {
  driverId: string;
  availableStampCount: number;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState("1");
  const [kind, setKind] = useState<StampRedeemKind>("CASH");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [operatorBalance, setOperatorBalance] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCount(availableStampCount > 0 ? "1" : "0");
      setKind("CASH");
      setNote("");
      void operatorCashApi
        .getMySummary()
        .then((s) => setOperatorBalance(s.balance))
        .catch(() => setOperatorBalance(null));
    }
  }, [open, availableStampCount]);

  const parsedCount = Number(count);
  const totalEstimate =
    Number.isInteger(parsedCount) && parsedCount > 0
      ? parsedCount * STAMP_UNIT
      : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isInteger(parsedCount) || parsedCount < 1) {
      toast.error("Pechat sonini to‘g‘ri kiriting");
      return;
    }
    if (parsedCount > availableStampCount) {
      toast.error(`Mavjud pechat: ${availableStampCount}`);
      return;
    }
    setIsSubmitting(true);
    try {
      await ledgerApi.redeemStamps(
        driverId,
        parsedCount,
        kind,
        note.trim() || undefined,
      );
      toast.success(`${parsedCount} ta pechat yechildi`);
      setOpen(false);
      onSuccess();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Pechat yechib bo‘lmadi"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="flex-1"
          disabled={availableStampCount < 1}
        >
          Pechat yechish
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Pechat yechish</DialogTitle>
            <DialogDescription>
              Eng eski pechatlar birinchi yechiladi. «Pulga» tanlansa operator
              pulidan ham ayriladi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Yechilmagan pechat:{" "}
              <span className="font-medium text-foreground">
                {availableStampCount}
              </span>
            </p>
            {kind === "CASH" && operatorBalance != null && (
              <p className="rounded-lg bg-muted/70 px-3 py-2 text-xs">
                Operator puli qoldig‘i:{" "}
                <span className="font-semibold">{formatUzs(operatorBalance)}</span>
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="redeem-count">Nechta pechat</Label>
              <Input
                id="redeem-count"
                type="number"
                inputMode="numeric"
                min={1}
                max={availableStampCount}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                required
              />
              {totalEstimate > 0 && (
                <p className="text-xs text-muted-foreground">
                  Taxminiy summa: {formatUzs(totalEstimate)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Nimaga almashtirish</Label>
              <Select
                value={kind}
                onValueChange={(v) => setKind(v as StampRedeemKind)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="redeem-note">Izoh (ixtiyoriy)</Label>
              <Textarea
                id="redeem-note"
                placeholder="Masalan: naqd 90 000 so‘m / 3 ta non"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={isSubmitting || availableStampCount < 1}
              className="w-full"
            >
              {isSubmitting && <Loader2 className="animate-spin" />}
              Yechishni tasdiqlash
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

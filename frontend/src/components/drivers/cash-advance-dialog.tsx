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
import { getApiErrorMessage } from "@/lib/api-client";
import { ledgerApi } from "@/lib/api/ledger";
import { operatorCashApi } from "@/lib/api/operator-cash";
import { formatUzs } from "@/lib/format";

export function CashAdvanceDialog({
  driverId,
  onSuccess,
}: {
  driverId: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [operatorBalance, setOperatorBalance] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void operatorCashApi
      .getMySummary()
      .then((s) => setOperatorBalance(s.balance))
      .catch(() => setOperatorBalance(null));
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(amount);
    if (!parsed || parsed <= 0) {
      toast.error("To'g'ri miqdorni kiriting");
      return;
    }
    setIsSubmitting(true);
    try {
      await ledgerApi.issueCashAdvance(driverId, parsed, description || undefined);
      toast.success("Avans berildi");
      setOpen(false);
      setAmount("");
      setDescription("");
      onSuccess();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Avans berib bo'lmadi"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex-1">
          Avans berish
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Avans berish</DialogTitle>
            <DialogDescription>
              Haydovchi balansidan va sizning operator pulingizdan ayriladi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {operatorBalance != null && (
              <p className="rounded-lg bg-muted/70 px-3 py-2 text-xs">
                Operator puli qoldig‘i:{" "}
                <span className="font-semibold">{formatUzs(operatorBalance)}</span>
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="advance-amount">Miqdor (UZS)</Label>
              <Input
                id="advance-amount"
                type="number"
                inputMode="numeric"
                min={1}
                placeholder="200000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="advance-description">Izoh (ixtiyoriy)</Label>
              <Textarea
                id="advance-description"
                placeholder="Avans sababi"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting && <Loader2 className="animate-spin" />}
              Avansni tasdiqlash
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

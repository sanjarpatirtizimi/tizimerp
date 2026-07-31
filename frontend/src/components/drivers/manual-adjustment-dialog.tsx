"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, SlidersHorizontal } from "lucide-react";
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

export function ManualAdjustmentDialog({
  driverId,
  onSuccess,
}: {
  driverId: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(amount);
    if (!parsed) {
      toast.error("Noldan farqli miqdorni kiriting (yechish uchun minus belgisidan foydalaning)");
      return;
    }
    if (!reason.trim()) {
      toast.error("Qo'lda tuzatish uchun sabab ko'rsatilishi shart");
      return;
    }
    setIsSubmitting(true);
    try {
      await ledgerApi.manualAdjustment(driverId, parsed, reason);
      toast.success("Tuzatish qayd etildi");
      setOpen(false);
      setAmount("");
      setReason("");
      onSuccess();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Tuzatishni qayd etib bo'lmadi"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <SlidersHorizontal />
          Qo&apos;lda tuzatish
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Balansni qo&apos;lda tuzatish</DialogTitle>
            <DialogDescription>
              Faqat Bosh administrator uchun. Hisoblash uchun musbat, yechish uchun manfiy son
              kiriting. Bu yangi yozuv yaratadi — tarixni hech qachon o&apos;zgartirmaydi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="adj-amount">Miqdor (UZS)</Label>
              <Input
                id="adj-amount"
                type="number"
                inputMode="numeric"
                placeholder="-50000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="adj-reason">Sabab</Label>
              <Textarea
                id="adj-reason"
                placeholder="Nima uchun bu tuzatish kiritilmoqda?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting && <Loader2 className="animate-spin" />}
              Tuzatishni tasdiqlash
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

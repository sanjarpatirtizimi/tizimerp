"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";
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
import { getApiErrorMessage } from "@/lib/api-client";
import { usersApi } from "@/lib/api/users";

/**
 * SuperAdmin-only quick action for creating a new Operator account directly
 * from the dashboard. Role is fixed to OPERATOR — SuperAdmin accounts cannot
 * be created through the UI.
 */
export function CreateOperatorDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await usersApi.create({ fullName, phone, password, role: "OPERATOR" });
      toast.success("Operator muvaffaqiyatli qo'shildi");
      setOpen(false);
      setFullName("");
      setPhone("");
      setPassword("");
      onCreated?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Operator qo'shib bo'lmadi"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus />
          Yangi operator
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Yangi operator qo&apos;shish</DialogTitle>
            <DialogDescription>
              Operator haydovchilarni ro&apos;yxatdan o&apos;tkazishi va ular bilan ishlashi mumkin bo&apos;ladi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="op-name">To&apos;liq ism</Label>
              <Input
                id="op-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="op-phone">Telefon raqami</Label>
              <Input
                id="op-phone"
                placeholder="+998 90 000 00 00"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="op-password">Parol</Label>
              <Input
                id="op-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Operatorni yaratish
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

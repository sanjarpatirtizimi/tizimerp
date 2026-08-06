"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api-client";
import { devicesApi } from "@/lib/api/devices";
import type { Device } from "@/lib/types";

/**
 * Add/edit form for a Hikvision device. In edit mode, the password field is
 * optional — leave it blank to keep the device's current stored password.
 */
export function DeviceFormDialog({
  device,
  trigger,
  onSuccess,
}: {
  /** Omit to create a new device; pass an existing device to edit it. */
  device?: Device;
  trigger: React.ReactNode;
  onSuccess: () => void;
}) {
  const isEdit = !!device;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(device?.name ?? "");
  const [ipAddress, setIpAddress] = useState(device?.ipAddress ?? "");
  const [port, setPort] = useState(String(device?.port ?? 80));
  const [username, setUsername] = useState(device?.username ?? "");
  const [password, setPassword] = useState("");
  const [location, setLocation] = useState(device?.location ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !device) return;
    // Re-sync the form with the latest device data every time the dialog
    // re-opens (e.g. after an earlier edit/ping refreshed the device list).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(device.name);
    setIpAddress(device.ipAddress);
    setPort(String(device.port));
    setUsername(device.username);
    setLocation(device.location ?? "");
    setPassword("");
  }, [open, device]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isEdit && device) {
        await devicesApi.update(device.id, {
          name,
          ipAddress,
          port: Number(port) || 80,
          username,
          ...(password ? { password } : {}),
          location: location || undefined,
        });
        toast.success("Qurilma yangilandi");
      } else {
        await devicesApi.create({
          name,
          ipAddress,
          port: Number(port) || 80,
          username,
          password,
          location: location || undefined,
        });
        toast.success("Qurilma qo'shildi");
        setName("");
        setIpAddress("");
        setPort("80");
        setUsername("");
        setPassword("");
        setLocation("");
      }
      setOpen(false);
      onSuccess();
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, isEdit ? "Qurilmani yangilab bo'lmadi" : "Qurilma qo'shib bo'lmadi"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Qurilma ma'lumotlarini tahrirlash" : "Hikvision qurilmasini qo'shish"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dev-name">Nomi</Label>
              <Input id="dev-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="dev-ip">IP manzil</Label>
                <Input
                  id="dev-ip"
                  placeholder="192.168.1.10"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dev-port">Port</Label>
                <Input id="dev-port" value={port} onChange={(e) => setPort(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="dev-user">Foydalanuvchi nomi</Label>
                <Input
                  id="dev-user"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dev-pass">
                  Parol {isEdit && <span className="text-muted-foreground">(ixtiyoriy)</span>}
                </Label>
                <Input
                  id="dev-pass"
                  type="password"
                  placeholder={isEdit ? "O'zgartirmaslik uchun bo'sh qoldiring" : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={!isEdit}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dev-location">Joylashuv (ixtiyoriy)</Label>
              <Input
                id="dev-location"
                placeholder="Asosiy darvoza"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              {isEdit ? "Saqlash" : "Qurilma qo'shish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

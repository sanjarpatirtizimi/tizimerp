"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ScanFace } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api-client";
import { devicesApi } from "@/lib/api/devices";
import { driversApi } from "@/lib/api/drivers";
import type { Device } from "@/lib/types";

/**
 * For drivers whose face was enrolled directly on the device's own local
 * UI (not through this app), the device assigns its own Person ID that has
 * nothing to do with our driver record. This dialog lets an operator
 * manually record that Person ID so recognition webhooks match correctly —
 * no network call to the device itself, just a database mapping.
 */
export function ManualFaceMappingDialog({
  driverId,
  onSuccess,
}: {
  driverId: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [faceId, setFaceId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    devicesApi.list().then(setDevices).catch(() => setDevices([]));
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!deviceId || !faceId.trim()) {
      toast.error("Qurilma va Person ID ni kiriting");
      return;
    }
    setIsSubmitting(true);
    try {
      await driversApi.setManualFaceMapping(driverId, deviceId, faceId.trim());
      toast.success("Face ID moslashtirildi");
      setOpen(false);
      setFaceId("");
      setDeviceId("");
      onSuccess();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Moslashtirib bo'lmadi"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ScanFace className="size-4" />
          Face ID moslashtirish
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Face ID qo&apos;lda moslashtirish</DialogTitle>
            <DialogDescription>
              Agar haydovchi yuzi qurilmaning o&apos;zida (mahalliy) ro&apos;yhatdan
              o&apos;tkazilgan bo&apos;lsa, qurilma bergan Person ID ni shu yerga kiriting —
              aks holda tanish hodisalari bu haydovchiga bog&apos;lanmaydi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mapping-device">Qurilma</Label>
              <Select value={deviceId} onValueChange={setDeviceId}>
                <SelectTrigger id="mapping-device" className="w-full">
                  <SelectValue placeholder="Qurilmani tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mapping-face-id">Person ID / Employee No</Label>
              <Input
                id="mapping-face-id"
                placeholder="Masalan: 1"
                value={faceId}
                onChange={(e) => setFaceId(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Qurilmaning &quot;User/Person Management&quot; bo&apos;limida shu haydovchi
                uchun ko&apos;rsatilgan ID.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting && <Loader2 className="animate-spin" />}
              Saqlash
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

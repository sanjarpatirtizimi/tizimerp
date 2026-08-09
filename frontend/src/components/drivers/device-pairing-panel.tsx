"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link2, Loader2, ScanFace, Unlink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { Device, Driver } from "@/lib/types";

const POLL_MS = 3000;

function msToClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * "Ulash rejimi" — a driver can be linked to several devices (e.g. one gate
 * on the way out, another on the way back). Operator explicitly picks ONE
 * not-yet-linked device and arms a 3-minute window; the next unrecognized
 * face touch on THAT device auto-completes the link. A face touch from the
 * previous few minutes is also accepted when Ulash starts. Repeat for each
 * additional device the driver needs.
 */
export function DevicePairingPanel({
  driver,
  onChanged,
}: {
  driver: Driver;
  onChanged: () => void | Promise<void>;
}) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    devicesApi.list().then(setDevices).catch(() => setDevices([]));
  }, []);

  const registrations = driver.deviceRegistrations ?? [];
  const linked = registrations.filter((r) => r.hikvisionFaceId);
  const pending = registrations.find(
    (r) => !r.hikvisionFaceId && r.pairingExpiresAt && new Date(r.pairingExpiresAt).getTime() > now,
  );
  // A device is "taken" (hidden from the picker) while confirmed OR while a
  // pairing window for it is still counting down. Once a window expires
  // without a face touch, its device becomes selectable again.
  const takenDeviceIds = new Set(
    registrations
      .filter(
        (r) =>
          r.hikvisionFaceId ||
          (r.pairingExpiresAt && new Date(r.pairingExpiresAt).getTime() > now),
      )
      .map((r) => r.deviceId),
  );
  const availableDevices = useMemo(
    () => devices.filter((d) => !takenDeviceIds.has(d.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [devices, registrations, now],
  );

  // Tick the countdown, and poll the driver for confirmation while a
  // pairing window is armed.
  useEffect(() => {
    if (!pending) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(() => {
      onChanged();
    }, POLL_MS);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.deviceId, pending?.pairingExpiresAt]);

  async function handleStart() {
    if (!selectedDeviceId) {
      toast.error("Avval qurilmani tanlang");
      return;
    }
    setIsStarting(true);
    try {
      const result = await driversApi.startDevicePairing(
        driver.id,
        selectedDeviceId,
      );
      setSelectedDeviceId("");
      await onChanged();
      if (result.paired) {
        toast.success("Qurilma ulandi (oldingi yuz tutishdan)");
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Ulash rejimini boshlab bo'lmadi"));
    } finally {
      setIsStarting(false);
    }
  }

  async function handleCancel(deviceId: string) {
    setIsCancelling(true);
    try {
      await driversApi.cancelDevicePairing(driver.id, deviceId);
      await onChanged();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Bekor qilib bo'lmadi"));
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleUnlink(deviceId: string) {
    setIsUnlinking(deviceId);
    try {
      await driversApi.unlinkDevice(driver.id, deviceId);
      toast.success("Qurilma uzildi");
      await onChanged();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Uzib bo'lmadi"));
    } finally {
      setIsUnlinking(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Zaxira: Ulash rejimi</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Faqat agent/ISAPI ishlamagan qurilmalar uchun. Asosiy yo&apos;l —
          yuqoridagi &quot;Avtomatik yuz yuklash&quot;.
        </p>
        {linked.length > 0 && (
          <ul className="space-y-2">
            {linked.map((reg) => (
              <li
                key={reg.id}
                className="flex items-center gap-2 rounded-md border p-2.5 text-sm"
              >
                <ScanFace className="size-4 shrink-0 text-success" />
                <span className="min-w-0 flex-1 truncate">{reg.device.name}</span>
                <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">
                  Ulangan
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  disabled={isUnlinking === reg.deviceId}
                  onClick={() => handleUnlink(reg.deviceId)}
                  aria-label="Uzish"
                >
                  {isUnlinking === reg.deviceId ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Unlink className="size-4" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {pending ? (
          <div className="flex items-center gap-3 rounded-md border border-dashed p-3 text-sm">
            <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {devices.find((d) => d.id === pending.deviceId)?.name ?? pending.deviceId}
              </p>
              <p className="text-xs text-muted-foreground">
                Haydovchi yuzini shu qurilmaga tutishini kutmoqda —{" "}
                {msToClock(new Date(pending.pairingExpiresAt!).getTime() - now)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={isCancelling}
              onClick={() => handleCancel(pending.deviceId)}
              aria-label="Bekor qilish"
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          availableDevices.length > 0 && (
            <div className="flex items-center gap-2">
              <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Yangi qurilmani tanlang" />
                </SelectTrigger>
                <SelectContent>
                  {availableDevices.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleStart} disabled={isStarting} className="shrink-0 gap-1">
                {isStarting ? <Loader2 className="animate-spin" /> : <Link2 className="size-4" />}
                Boshlash
              </Button>
            </div>
          )
        )}

        {!pending && linked.length === 0 && availableDevices.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Hozircha hech qanday qurilma tizimga signal yubormagan.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

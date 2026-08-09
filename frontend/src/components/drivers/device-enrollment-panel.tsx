"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/api-client";
import { devicesApi } from "@/lib/api/devices";
import { driversApi } from "@/lib/api/drivers";
import type { Device, Driver, SyncStatus } from "@/lib/types";

const syncLabels: Record<SyncStatus, string> = {
  PENDING: "Agent kutmoqda",
  SYNCED: "Yuklangan",
  FAILED: "Xato",
};

const syncStyles: Record<SyncStatus, string> = {
  PENDING: "bg-amber-500/15 text-amber-700",
  SYNCED: "bg-success/15 text-success",
  FAILED: "bg-destructive/15 text-destructive",
};

/**
 * Primary enrollment status: face pushed to devices under unique Person ID
 * (= driver.id) via relay agent or direct ISAPI. Distinct from Ulash pairing.
 */
export function DeviceEnrollmentPanel({
  driver,
  onChanged,
}: {
  driver: Driver;
  onChanged: () => void | Promise<void>;
}) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [isRetryingAll, setIsRetryingAll] = useState(false);

  useEffect(() => {
    devicesApi
      .list()
      .then((all) => setDevices(all.filter((d) => d.ipAddress || d.hasAgent)))
      .catch(() => setDevices([]));
  }, []);

  const registrations = driver.deviceRegistrations ?? [];
  // Agent/ISAPI jobs never set pairingExpiresAt while waiting for push.
  const enrollmentRegs = registrations.filter(
    (r) => r.hikvisionFaceId || r.pairingExpiresAt == null,
  );

  // Poll while the relay agent is still working so the UI flips to SYNCED.
  const hasAgentPending = enrollmentRegs.some((r) => r.syncStatus === "PENDING");
  useEffect(() => {
    if (!hasAgentPending) return;
    const timer = setInterval(() => {
      void onChanged();
    }, 2500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAgentPending, driver.id]);

  const enrollableNotQueued = useMemo(() => {
    const taken = new Set(enrollmentRegs.map((r) => r.deviceId));
    return devices.filter((d) => !taken.has(d.id));
  }, [devices, enrollmentRegs]);

  const pendingOrFailed = enrollmentRegs.filter(
    (r) => r.syncStatus === "PENDING" || r.syncStatus === "FAILED",
  );

  async function retry(deviceIds: string[]) {
    if (!driver.photoUrl) {
      toast.error("Haydovchida rasm yo'q — avval rasm yuklang");
      return;
    }
    try {
      await driversApi.requeueEnrollment(driver.id, deviceIds);
      toast.success("Qurilmaga qayta yuborish navbatga qo'yildi");
      await onChanged();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Qayta yuborib bo'lmadi"));
    }
  }

  async function handleRetryOne(deviceId: string) {
    setRetryingId(deviceId);
    try {
      await retry([deviceId]);
    } finally {
      setRetryingId(null);
    }
  }

  async function handleRetryAll() {
    const ids = pendingOrFailed.map((r) => r.deviceId);
    if (ids.length === 0) return;
    setIsRetryingAll(true);
    try {
      await retry(ids);
    } finally {
      setIsRetryingAll(false);
    }
  }

  async function handleEnqueueNew(deviceId: string) {
    setRetryingId(deviceId);
    try {
      await retry([deviceId]);
    } finally {
      setRetryingId(null);
    }
  }

  if (!driver.photoUrl && enrollmentRegs.length === 0 && enrollableNotQueued.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Avtomatik yuz yuklash</CardTitle>
        {pendingOrFailed.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-1"
            disabled={isRetryingAll}
            onClick={handleRetryAll}
          >
            {isRetryingAll ? <Loader2 className="animate-spin" /> : <RefreshCw className="size-3.5" />}
            Qayta yuborish
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Har bir haydovchiga unique Person ID beriladi (chalkashmaydi). Relay agent
          rasmni qurilmaga 1–2 soniyada yuboradi.
        </p>

        {enrollmentRegs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Hali hech qanday qurilmaga yuklash navbati yo&apos;q.
          </p>
        ) : (
          <ul className="space-y-2">
            {enrollmentRegs.map((reg) => (
              <li
                key={reg.id}
                className="flex items-center gap-2 rounded-md border p-2.5 text-sm"
              >
                <ScanFace className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{reg.device.name}</p>
                  {reg.syncStatus === "FAILED" && reg.syncError && (
                    <p className="truncate text-xs text-destructive">{reg.syncError}</p>
                  )}
                  {reg.syncStatus === "SYNCED" && reg.hikvisionFaceId && (
                    <p className="truncate text-xs text-muted-foreground">
                      Person ID: {reg.hikvisionFaceId.slice(0, 12)}…
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${syncStyles[reg.syncStatus]}`}
                >
                  {syncLabels[reg.syncStatus]}
                </span>
                {(reg.syncStatus === "FAILED" || reg.syncStatus === "PENDING") && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={retryingId === reg.deviceId || !driver.photoUrl}
                    onClick={() => handleRetryOne(reg.deviceId)}
                    aria-label="Qayta yuborish"
                  >
                    {retryingId === reg.deviceId ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {enrollableNotQueued.length > 0 && driver.photoUrl && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs text-muted-foreground">Qo&apos;shimcha qurilmaga yuklash:</p>
            {enrollableNotQueued.map((device) => (
              <div
                key={device.id}
                className="flex items-center gap-2 rounded-md border border-dashed p-2.5 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">{device.name}</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={retryingId === device.id}
                  onClick={() => handleEnqueueNew(device.id)}
                >
                  {retryingId === device.id ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    "Yuklash"
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}

        {!driver.photoUrl && (
          <p className="text-sm text-amber-700">
            Avtomatik yuklash uchun haydovchiga rasm qo&apos;shilishi shart.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

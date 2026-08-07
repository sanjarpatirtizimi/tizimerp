"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, RefreshCw, Server, Trash2 } from "lucide-react";
import { RequireStaff } from "@/components/auth/route-guard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DeviceFormDialog } from "@/components/devices/device-form-dialog";
import { getApiErrorMessage } from "@/lib/api-client";
import { devicesApi } from "@/lib/api/devices";
import type { Device, DeviceStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { deviceStatusLabels, formatDateTime } from "@/lib/format";

const statusStyles: Record<DeviceStatus, string> = {
  ONLINE: "bg-success/15 text-success",
  OFFLINE: "bg-muted-foreground/15 text-muted-foreground",
  MAINTENANCE: "bg-amber-500/15 text-amber-600",
  ERROR: "bg-destructive/15 text-destructive",
};

export default function DevicesPage() {
  return (
    <RequireStaff roles={["SUPER_ADMIN"]}>
      <DevicesPageContent />
    </RequireStaff>
  );
}

function DevicesPageContent() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function loadDevices() {
    devicesApi
      .list()
      .then(setDevices)
      .finally(() => setIsLoading(false));
  }

  useEffect(loadDevices, []);

  async function handlePing(id: string) {
    setPingingId(id);
    try {
      const updated = await devicesApi.ping(id);
      setDevices((prev) => prev.map((d) => (d.id === id ? updated : d)));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Ulanishni tekshirib bo'lmadi"));
    } finally {
      setPingingId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await devicesApi.remove(id);
      toast.success("Qurilma o'chirildi");
      setDevices((prev) => prev.filter((d) => d.id !== id));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Qurilmani o'chirib bo'lmadi"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Qurilmalar</h1>
        <DeviceFormDialog
          onSuccess={loadDevices}
          trigger={
            <Button size="sm">
              <Plus />
              Qurilma qo&apos;shish
            </Button>
          }
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : devices.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Hozircha qurilmalar yo&apos;q.</p>
      ) : (
        <ul className="space-y-2">
          {devices.map((device) => (
            <li key={device.id}>
              <Card>
                <CardContent className="flex items-center gap-3 py-2">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Server className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{device.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {device.ipAddress
                        ? `${device.ipAddress}:${device.port}`
                        : "Webhook orqali avtomatik ulangan"}
                      {device.location ? ` • ${device.location}` : ""}
                    </p>
                    {device.lastPingAt && (
                      <p className="text-xs text-muted-foreground">
                        Oxirgi tekshiruv: {formatDateTime(device.lastPingAt)}
                      </p>
                    )}
                  </div>
                  <Badge className={cn(statusStyles[device.status])} variant="outline">
                    {deviceStatusLabels[device.status]}
                  </Badge>
                  {device.ipAddress && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handlePing(device.id)}
                      disabled={pingingId === device.id}
                      aria-label="Ulanishni tekshirish"
                    >
                      {pingingId === device.id ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <RefreshCw />
                      )}
                    </Button>
                  )}
                  <DeviceFormDialog
                    device={device}
                    onSuccess={loadDevices}
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label="Tahrirlash">
                        <Pencil />
                      </Button>
                    }
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        disabled={deletingId === device.id}
                        aria-label="O'chirish"
                      >
                        {deletingId === device.id ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <Trash2 />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Qurilmani o&apos;chirish?</AlertDialogTitle>
                        <AlertDialogDescription>
                          &quot;{device.name}&quot; qurilmasi butunlay o&apos;chiriladi. Agar bu
                          qurilmada tanish tarixi (recognition events) yoki tranzaksiyalar
                          mavjud bo&apos;lsa, o&apos;chirish rad etiladi.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Bekor qilish</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => handleDelete(device.id)}
                        >
                          O&apos;chirish
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

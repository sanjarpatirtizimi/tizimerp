"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, RefreshCw, Server, Trash2 } from "lucide-react";
import { RequireStaff } from "@/components/auth/route-guard";
import { useAuth } from "@/lib/auth-context";
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
import { AgentKeyDialog } from "@/components/devices/agent-key-dialog";
import { API_URL, getApiErrorMessage } from "@/lib/api-client";
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

const AGENT_RAW =
  "https://raw.githubusercontent.com/sanjarpatirtizimi/tizimerp/cursor/fix-relay-face-jpeg-2ec4/relay-agent";

async function downloadAgentFile(file: string) {
  const urls = [`${API_URL}/public/relay-agent/${file}`, `${AGENT_RAW}/${file}`];
  let lastError: unknown;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = file;
      a.click();
      URL.revokeObjectURL(href);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function AgentUpdateCard() {
  const [busy, setBusy] = useState<string | null>(null);

  async function handleDownload(file: string) {
    setBusy(file);
    try {
      await downloadAgentFile(file);
      toast.success(`${file} yuklandi — relay-agent papkasiga qo'ying`);
    } catch {
      toast.error("Yuklab bo'lmadi. GitHub ochiqligini tekshiring");
    } finally {
      setBusy(null);
    }
  }

  async function handleClearQueue() {
    setBusy("clear");
    try {
      const result = await devicesApi.clearEnrollmentQueue();
      toast.success(
        `Navbat tozalandi: ${result.clearedJobs} ta ish, ${result.removedDrivers} ta kutilgan haydovchi o'chirildi`,
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Navbatni tozalab bo'lmadi"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="border-amber-500/40 bg-amber-500/10">
      <CardContent className="space-y-2 py-3">
        <p className="text-sm font-medium">Haydovchi yuzi yuklanmasa</p>
        <p className="text-xs text-muted-foreground">
          Gate kompyuterida <code>relay-agent</code> va <code>relay-agent2</code> papkasiga
          yangi <code>index.js</code> ni qo&apos;ying, keyin <code>npm start</code> — logda
          <code>Versiya 1.2.4</code> chiqishi kerak. Navbatda haydovchi bo‘lsa pechat
          so‘ralmaydi — aks holda Face ID timeout qiladi.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={busy !== null}
            onClick={() => void handleDownload("update.cmd")}
          >
            {busy === "update.cmd" ? <Loader2 className="animate-spin" /> : null}
            update.cmd
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => void handleDownload("index.js")}
          >
            {busy === "index.js" ? <Loader2 className="animate-spin" /> : null}
            index.js
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive" disabled={busy !== null}>
                {busy === "clear" ? <Loader2 className="animate-spin" /> : null}
                Navbatni tozalash
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Navbat va kutilgan haydovchilar</AlertDialogTitle>
                <AlertDialogDescription>
                  Face ID ga yuborilmagan barcha navbat o&apos;chadi. Pechati yoki
                  yozilgan yuzi yo&apos;q haydovchilar ham o&apos;chadi. Pul/pechat
                  yozuvlari saqlanadi.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Bekor</AlertDialogCancel>
                <AlertDialogAction onClick={() => void handleClearQueue()}>
                  Tozalash
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DevicesPage() {
  return (
    <RequireStaff roles={["SUPER_ADMIN", "OPERATOR"]}>
      <DevicesPageContent />
    </RequireStaff>
  );
}

function DevicesPageContent() {
  const { claims } = useAuth();
  const isSuperAdmin = claims?.kind === "staff" && claims.role === "SUPER_ADMIN";
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
      <AgentUpdateCard />
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Qurilmalar</h1>
        {isSuperAdmin && (
          <DeviceFormDialog
            onSuccess={loadDevices}
            trigger={
              <Button size="sm">
                <Plus />
                Qurilma qo&apos;shish
              </Button>
            }
          />
        )}
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
                    <p className="truncate font-medium">
                      {device.name}
                      {device.hasAgent && (
                        <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-normal text-primary">
                          Agent ulangan
                        </span>
                      )}
                    </p>
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
                  <AgentKeyDialog device={device} onIssued={loadDevices} />
                  {isSuperAdmin && (
                    <>
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
                    </>
                  )}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw, Server } from "lucide-react";
import { RequireStaff } from "@/components/auth/route-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
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
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [port, setPort] = useState("80");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [location, setLocation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await devicesApi.create({
        name,
        ipAddress,
        port: Number(port) || 80,
        username,
        password,
        location: location || undefined,
      });
      toast.success("Qurilma qo'shildi");
      setOpen(false);
      setName("");
      setIpAddress("");
      setPort("80");
      setUsername("");
      setPassword("");
      setLocation("");
      loadDevices();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Qurilma qo'shib bo'lmadi"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Qurilmalar</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus />
              Qurilma qo&apos;shish
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Hikvision qurilmasini qo&apos;shish</DialogTitle>
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
                    <Label htmlFor="dev-pass">Parol</Label>
                    <Input
                      id="dev-pass"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
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
                  Qurilma qo&apos;shish
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
                      {device.ipAddress}:{device.port}
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
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handlePing(device.id)}
                    disabled={pingingId === device.id}
                  >
                    {pingingId === device.id ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <RefreshCw />
                    )}
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

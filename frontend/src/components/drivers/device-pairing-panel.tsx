"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link2, Loader2, ScanFace, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

/**
 * Manual device linking: operator enrolls the face on the Face ID terminal
 * themselves, then records which device + Person ID belongs to this driver.
 * Recognition webhooks then match employeeNo → hikvisionFaceId → stamp.
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
  const [personId, setPersonId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState<string | null>(null);

  useEffect(() => {
    devicesApi.list().then(setDevices).catch(() => setDevices([]));
  }, []);

  const registrations = driver.deviceRegistrations ?? [];
  const linked = registrations.filter((r) => r.hikvisionFaceId);
  const linkedDeviceIds = useMemo(
    () => new Set(linked.map((r) => r.deviceId)),
    [linked],
  );

  async function handleSave() {
    if (!selectedDeviceId) {
      toast.error("Qurilmani tanlang");
      return;
    }
    const faceId = personId.trim();
    if (!faceId) {
      toast.error("Face ID dagi Person ID ni yozing (masalan: 1, 2, 15)");
      return;
    }

    setIsSaving(true);
    try {
      await driversApi.setManualFaceMapping(driver.id, selectedDeviceId, faceId);
      toast.success("Qurilma saqlandi — endi pechat yoziladi");
      setSelectedDeviceId("");
      setPersonId("");
      await onChanged();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Saqlab bo'lmadi"));
    } finally {
      setIsSaving(false);
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
        <CardTitle className="text-base">Qurilma ulash</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          1) Face ID qurilmasida haydovchini qo&apos;shing va Person ID ni eslab
          qoling. 2) Pastda shu qurilmani tanlang, Person ID ni yozing va
          saqlang. Shundan keyin qarasa pechat yoziladi.
        </p>

        {linked.length > 0 && (
          <ul className="space-y-2">
            {linked.map((reg) => (
              <li
                key={reg.id}
                className="flex items-center gap-2 rounded-md border p-2.5 text-sm"
              >
                <ScanFace className="size-4 shrink-0 text-success" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{reg.device.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Person ID: <span className="font-medium text-foreground">{reg.hikvisionFaceId}</span>
                    {" · "}Qurilma ID: {reg.deviceId}
                  </p>
                </div>
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

        <div className="space-y-2 rounded-md border p-3">
          <Select
            value={selectedDeviceId}
            onValueChange={setSelectedDeviceId}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Qurilmani tanlang" />
            </SelectTrigger>
            <SelectContent>
              {devices.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                  {linkedDeviceIds.has(d.id) ? " (yangilash)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            placeholder="Face ID Person ID — Face ID ekranidagi raqam"
            inputMode="text"
          />
          <Button
            className="w-full gap-1"
            onClick={handleSave}
            disabled={isSaving || devices.length === 0}
          >
            {isSaving ? <Loader2 className="animate-spin" /> : <Link2 className="size-4" />}
            Saqlash
          </Button>
          <p className="text-[11px] text-muted-foreground">
            Person ID Face ID ekranidagi raqam bilan bir xil bo&apos;lishi kerak.
            Relay-agent ishlayotgan bo&apos;lsa, yuz tanilganda pechat yoziladi.
          </p>
        </div>

        {devices.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Hozircha qurilma yo&apos;q. Avval Face ID signal yuborsin yoki
            Qurilmalar sahifasidan qo&apos;shing.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

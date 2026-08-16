"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CarNameField, CarPlateField } from "@/components/drivers/car-fields";
import { FacePhotoPicker } from "@/components/drivers/face-photo-picker";
import { getApiErrorMessage } from "@/lib/api-client";
import { driversApi } from "@/lib/api/drivers";
import { devicesApi } from "@/lib/api/devices";
import { isValidCarPlate } from "@/lib/car-plate";
import type { Device } from "@/lib/types";

export function DriverForm() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [carPlate, setCarPlate] = useState("");
  const [carBrand, setCarBrand] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const photoPreview = useMemo(
    () => (photo ? URL.createObjectURL(photo) : null),
    [photo],
  );

  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    devicesApi
      .list()
      .then((all) => {
        const enrollable = all.filter((d) => d.ipAddress || d.hasAgent);
        // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load
        setDevices(enrollable);
        // Default: select every device that has a relay agent (safest primary path).
        setSelectedDeviceIds(enrollable.filter((d) => d.hasAgent).map((d) => d.id));
      })
      .catch(() => undefined);
  }, []);

  function toggleDevice(id: string, checked: boolean) {
    setSelectedDeviceIds((prev) =>
      checked ? [...prev, id] : prev.filter((d) => d !== id),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName || !phone) {
      toast.error("Ism va telefon majburiy");
      return;
    }
    if (selectedDeviceIds.length > 0 && !photo) {
      toast.error("Qurilmaga yuklash uchun haydovchi rasmi majburiy");
      return;
    }
    if (!photo) {
      toast.error("Yuz rasmi majburiy — chalkashmaslik uchun unique ID bilan yuklanadi");
      return;
    }
    if (carPlate && !isValidCarPlate(carPlate)) {
      toast.error("Mashina raqamini to'g'ri yozing. Masalan: 01A123AB");
      return;
    }

    setIsSubmitting(true);
    try {
      const driver = await driversApi.create({
        fullName,
        phone,
        password: password || undefined,
        carPlate: carPlate || undefined,
        carBrand: carBrand || undefined,
        deviceIds: selectedDeviceIds,
        photo,
      });
      toast.success(
        selectedDeviceIds.length > 0
          ? `${driver.fullName} yaratildi — qurilmalarga yuklash boshlandi`
          : `${driver.fullName} muvaffaqiyatli ro'yxatdan o'tkazildi`,
      );
      router.push(`/staff/drivers/${driver.id}`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Haydovchini ro'yxatdan o'tkazib bo'lmadi"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Haydovchi ma&apos;lumotlari</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FacePhotoPicker
            previewUrl={photoPreview}
            onChange={setPhoto}
            hint="Kamerani bosing. Yuzni chiziq ichiga qo'ying — Face ID shu rasm bilan yoziladi."
          />

          <div className="space-y-2">
            <Label htmlFor="fullName">Ismi</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              inputMode="tel"
              placeholder="+998 90 000 00 00"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Parol (ixtiyoriy)</Label>
            <Input
              id="password"
              type="password"
              placeholder="Ilovaga kirish uchun"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CarPlateField id="carPlate" value={carPlate} onChange={setCarPlate} />
            <CarNameField id="carBrand" value={carBrand} onChange={setCarBrand} />
          </div>
        </CardContent>
      </Card>

      {devices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Qurilmalarga avtomatik yuklash</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Tanlangan qurilmalarga rasm unique Person ID bilan yuboriladi (relay agent
              orqali). Bu asosiy va xavfsiz yo&apos;l — Ulash rejimi faqat zaxira.
            </p>
            {devices.map((device) => (
              <label
                key={device.id}
                className="flex items-center gap-3 rounded-md border p-3 text-sm"
              >
                <Checkbox
                  checked={selectedDeviceIds.includes(device.id)}
                  onCheckedChange={(checked) => toggleDevice(device.id, checked === true)}
                />
                <span className="flex-1">
                  {device.name}
                  <span className="block text-xs text-muted-foreground">
                    {device.hasAgent
                      ? "Relay agent orqali (tavsiya)"
                      : (device.ipAddress ?? "ISAPI")}
                  </span>
                </span>
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" />}
        Haydovchini ro&apos;yxatdan o&apos;tkazish
      </Button>
    </form>
  );
}

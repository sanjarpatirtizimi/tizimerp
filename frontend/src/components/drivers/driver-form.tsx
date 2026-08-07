"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { getApiErrorMessage } from "@/lib/api-client";
import { driversApi } from "@/lib/api/drivers";
import { devicesApi } from "@/lib/api/devices";
import type { Device } from "@/lib/types";

export function DriverForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [carPlate, setCarPlate] = useState("");
  const [carBrand, setCarBrand] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    devicesApi
      .list()
      // Only devices with real ISAPI credentials support push enrollment
      // here; zero-config (webhook-only) devices are linked afterwards via
      // "Ulash rejimi" on the driver's own page.
      .then((all) => setDevices(all.filter((d) => d.ipAddress)))
      .catch(() => undefined);
  }, []);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  function toggleDevice(id: string, checked: boolean) {
    setSelectedDeviceIds((prev) => (checked ? [...prev, id] : prev.filter((d) => d !== id)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName || !phone) {
      toast.error("To'liq ism va telefon raqami kiritilishi shart");
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
      toast.success(`${driver.fullName} muvaffaqiyatli ro'yxatdan o'tkazildi`);
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
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative flex size-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed bg-muted text-muted-foreground"
            >
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="Driver" className="size-full object-cover" />
              ) : (
                <Camera className="size-6" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoChange}
            />
            {photoPreview && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="ml-1 self-start"
                onClick={() => {
                  setPhoto(null);
                  setPhotoPreview(null);
                }}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Rasm Hikvision yuz tanish tizimiga ro&apos;yxatga olish uchun ishlatiladi
          </p>

          <div className="space-y-2">
            <Label htmlFor="fullName">To&apos;liq ism</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefon raqami</Label>
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
            <p className="text-xs text-muted-foreground">
              Agar kiritilsa, haydovchi shu parol bilan ilovaga kira oladi.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="carPlate">Davlat raqami</Label>
              <Input
                id="carPlate"
                placeholder="01 A 123 AA"
                value={carPlate}
                onChange={(e) => setCarPlate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="carBrand">Avtomobil markasi</Label>
              <Input
                id="carBrand"
                placeholder="Isuzu"
                value={carBrand}
                onChange={(e) => setCarBrand(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {devices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Qurilmalarga ulash (ilg&apos;or, ixtiyoriy)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Bu faqat ISAPI orqali sozlangan qurilmalar uchun — rasm shu zahoti qurilmaga
              yuklanadi. Oddiy holatda buni tashlab, keyinroq haydovchi sahifasidan
              &quot;Ulash rejimi&quot; orqali qurilmaga ulang.
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
                  <span className="block text-xs text-muted-foreground">{device.ipAddress}</span>
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

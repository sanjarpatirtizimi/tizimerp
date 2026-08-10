"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2, Pencil } from "lucide-react";
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
import { API_URL, getApiErrorMessage } from "@/lib/api-client";
import { driversApi } from "@/lib/api/drivers";
import type { Driver } from "@/lib/types";

const backendOrigin = API_URL.replace(/\/api\/?$/, "");

function photoSrc(photoUrl: string | null | undefined): string | undefined {
  if (!photoUrl) return undefined;
  if (photoUrl.startsWith("http")) return photoUrl;
  return `${backendOrigin}${photoUrl}`;
}

export function EditDriverDialog({
  driver,
  onSuccess,
}: {
  driver: Driver;
  onSuccess: (driver: Driver) => void | Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(driver.fullName);
  const [phone, setPhone] = useState(driver.phone);
  const [password, setPassword] = useState("");
  const [carPlate, setCarPlate] = useState(driver.carPlate ?? "");
  const [carBrand, setCarBrand] = useState(driver.carBrand ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync form when dialog opens
    setFullName(driver.fullName);
    setPhone(driver.phone);
    setPassword("");
    setCarPlate(driver.carPlate ?? "");
    setCarBrand(driver.carBrand ?? "");
    setPhoto(null);
    setPhotoPreview(null);
  }, [open, driver]);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSave() {
    if (!fullName.trim() || !phone.trim()) {
      toast.error("Ism va telefon majburiy");
      return;
    }
    setIsSaving(true);
    try {
      let updated = await driversApi.update(driver.id, {
        fullName: fullName.trim(),
        phone: phone.trim(),
        password: password || undefined,
        carPlate: carPlate.trim(),
        carBrand: carBrand.trim(),
      });
      if (photo) {
        updated = await driversApi.updatePhoto(driver.id, photo);
      }
      toast.success("Ma'lumotlar saqlandi");
      setOpen(false);
      await onSuccess(updated);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Saqlab bo'lmadi"));
    } finally {
      setIsSaving(false);
    }
  }

  const currentPhoto = photoPreview ?? photoSrc(driver.photoUrl);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Pencil className="size-3.5" />
          Tahrirlash
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Haydovchini tahrirlash</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative flex size-24 items-center justify-center overflow-hidden rounded-full border-2 border-dashed bg-muted"
            >
              {currentPhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={currentPhoto} alt={fullName} className="size-full object-cover" />
              ) : (
                <Camera className="size-6 text-muted-foreground" />
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
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Rasmni bosib almashtiring — bazada saqlanadi
          </p>

          <div className="space-y-2">
            <Label htmlFor="edit-fullName">To&apos;liq ism</Label>
            <Input
              id="edit-fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-phone">Telefon raqami</Label>
            <Input
              id="edit-phone"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-password">Yangi parol (ixtiyoriy)</Label>
            <Input
              id="edit-password"
              type="password"
              placeholder="O'zgartirmasangiz bo'sh qoldiring"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-carPlate">Davlat raqami</Label>
              <Input
                id="edit-carPlate"
                value={carPlate}
                onChange={(e) => setCarPlate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-carBrand">Avtomobil markasi</Label>
              <Input
                id="edit-carBrand"
                value={carBrand}
                onChange={(e) => setCarBrand(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
            Bekor qilish
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="animate-spin" />}
            Saqlash
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

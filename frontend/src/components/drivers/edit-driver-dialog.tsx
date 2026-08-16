"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
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
import { CarNameField, CarPlateField } from "@/components/drivers/car-fields";
import { FacePhotoPicker } from "@/components/drivers/face-photo-picker";
import { API_URL, getApiErrorMessage } from "@/lib/api-client";
import { driversApi } from "@/lib/api/drivers";
import { isValidCarPlate } from "@/lib/car-plate";
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
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(driver.fullName);
  const [phone, setPhone] = useState(driver.phone);
  const [password, setPassword] = useState("");
  const [carPlate, setCarPlate] = useState(driver.carPlate ?? "");
  const [carBrand, setCarBrand] = useState(driver.carBrand ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const newPhotoPreview = useMemo(
    () => (photo ? URL.createObjectURL(photo) : null),
    [photo],
  );

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync form when dialog opens
    setFullName(driver.fullName);
    setPhone(driver.phone);
    setPassword("");
    setCarPlate(driver.carPlate ?? "");
    setCarBrand(driver.carBrand ?? "");
    setPhoto(null);
  }, [open, driver]);

  async function handleSave() {
    if (!fullName.trim() || !phone.trim()) {
      toast.error("Ism va telefon majburiy");
      return;
    }
    if (carPlate.trim() && !isValidCarPlate(carPlate)) {
      toast.error("Mashina raqamini to'g'ri yozing. Masalan: 01A123AB");
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

  const previewUrl = newPhotoPreview ?? photoSrc(driver.photoUrl) ?? null;

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
          <FacePhotoPicker
            previewUrl={previewUrl}
            onChange={setPhoto}
            hint="Kamerani bosing. Yuzni chiziq ichiga qo'ying."
          />

          <div className="space-y-2">
            <Label htmlFor="edit-fullName">Ismi</Label>
            <Input
              id="edit-fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-phone">Telefon</Label>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CarPlateField
              id="edit-carPlate"
              value={carPlate}
              onChange={setCarPlate}
            />
            <CarNameField
              id="edit-carBrand"
              value={carBrand}
              onChange={setCarBrand}
            />
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

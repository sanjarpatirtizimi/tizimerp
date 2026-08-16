"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand/brand-logo";
import { CarNameField, CarPlateField } from "@/components/drivers/car-fields";
import { FacePhotoPicker } from "@/components/drivers/face-photo-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/lib/api-client";
import { selfRegisterDriver } from "@/lib/api/self-register";
import { isValidCarPlate } from "@/lib/car-plate";

export default function RoyxatPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-svh items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </main>
      }
    >
      <RoyxatForm />
    </Suspense>
  );
}

function RoyxatForm() {
  const searchParams = useSearchParams();
  const token = (searchParams.get("k") ?? "").trim();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [carPlate, setCarPlate] = useState("");
  const [carBrand, setCarBrand] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const previewUrl = useMemo(
    () => (photo ? URL.createObjectURL(photo) : null),
    [photo],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [doneName, setDoneName] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      toast.error("QR kodni skaner qiling");
      return;
    }
    if (!fullName.trim() || !phone.trim() || !carBrand.trim()) {
      toast.error("Hamma joyini to'ldiring");
      return;
    }
    if (!isValidCarPlate(carPlate)) {
      toast.error("Mashina raqamini to'g'ri yozing. Masalan: 01A123AB");
      return;
    }
    if (!photo) {
      toast.error("Yuzingizning rasmini oling");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await selfRegisterDriver({
        token,
        fullName: fullName.trim(),
        phone: phone.trim(),
        carPlate,
        carBrand: carBrand.trim(),
        photo,
      });
      setDoneName(result.fullName);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Yozib bo'lmadi. Qayta urinib ko'ring"));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <main className="login-atmosphere relative flex min-h-svh flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="relative z-10 max-w-sm text-center">
          <BrandLogo variant="hero" />
          <p className="mt-6 text-base text-muted-foreground">
            Bu sahifa QR kod orqali ochiladi. Stoldagi kodni skaner qiling.
          </p>
        </div>
      </main>
    );
  }

  if (doneName) {
    return (
      <main className="login-atmosphere relative flex min-h-svh flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="relative z-10 max-w-sm text-center">
          <BrandLogo variant="hero" />
          <p className="mt-6 text-xl font-semibold text-[var(--brand-crust)]">
            Rahmat, {doneName}!
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Siz yozildingiz. Face ID oldida turing — pechat tushadi.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="login-atmosphere relative flex min-h-svh flex-1 flex-col items-center px-5 py-8">
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex flex-col items-center">
          <BrandLogo variant="hero" />
          <p className="mt-3 text-center text-sm text-muted-foreground">
            O&apos;zingizni yozing. 1 daqiqa.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="login-panel space-y-4 rounded-2xl border border-[var(--border)] bg-[rgb(255_253_248_/_0.92)] p-5 backdrop-blur-sm"
        >
          <FacePhotoPicker
            previewUrl={previewUrl}
            onChange={setPhoto}
            hint="Kamerani bosing. Yuzingizni chiziq ichiga qo'ying."
          />

          <div className="space-y-2">
            <Label htmlFor="fullName">Ismingiz</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ali Valiyev"
              autoComplete="name"
              required
              className="bg-white/80"
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
              autoComplete="tel"
              required
              className="bg-white/80"
            />
          </div>

          <CarPlateField
            id="carPlate"
            value={carPlate}
            onChange={setCarPlate}
            required
          />

          <CarNameField
            id="carBrand"
            value={carBrand}
            onChange={setCarBrand}
            required
          />

          <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="animate-spin" />}
            Yozilaman
          </Button>
        </form>
      </div>
    </main>
  );
}

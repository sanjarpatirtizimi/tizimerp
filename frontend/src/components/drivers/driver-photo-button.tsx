"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getApiErrorMessage, API_URL } from "@/lib/api-client";
import { driversApi } from "@/lib/api/drivers";
import { initials } from "@/lib/format";
import type { Driver } from "@/lib/types";

const backendOrigin = API_URL.replace(/\/api\/?$/, "");

function photoSrc(photoUrl: string | null | undefined): string | undefined {
  if (!photoUrl) return undefined;
  if (photoUrl.startsWith("http")) return photoUrl;
  return `${backendOrigin}${photoUrl}`;
}

export function DriverPhotoButton({
  driver,
  onUpdated,
}: {
  driver: Driver;
  onUpdated: (driver: Driver) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [cacheBust, setCacheBust] = useState(0);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsUploading(true);
    try {
      const updated = await driversApi.updatePhoto(driver.id, file);
      setCacheBust(Date.now());
      onUpdated(updated);
      toast.success("Rasm saqlandi — endi o‘chib ketmaydi");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Rasm yuklab bo‘lmadi"));
    } finally {
      setIsUploading(false);
    }
  }

  const src = photoSrc(driver.photoUrl);
  const srcWithBust = src ? `${src}${src.includes("?") ? "&" : "?"}v=${cacheBust || driver.updatedAt}` : undefined;

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={isUploading}
      className="relative shrink-0"
      aria-label="Rasm yuklash yoki almashtirish"
    >
      <Avatar className="size-14">
        {srcWithBust && <AvatarImage src={srcWithBust} alt={driver.fullName} />}
        <AvatarFallback>{initials(driver.fullName)}</AvatarFallback>
      </Avatar>
      <span className="absolute inset-x-0 bottom-0 flex items-center justify-center rounded-b-full bg-black/55 py-0.5 text-white">
        {isUploading ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <Camera className="size-3" />
        )}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleChange}
      />
    </button>
  );
}

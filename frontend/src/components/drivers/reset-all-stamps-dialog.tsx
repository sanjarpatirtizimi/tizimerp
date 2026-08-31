"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Eraser } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-client";
import { ledgerApi } from "@/lib/api/ledger";

/**
 * SuperAdmin-only bulk action: redeems every driver's outstanding pechats in
 * one shot. Driver profiles (ism, telefon, mashina) va tarix o'zgarmaydi —
 * faqat yechilmagan pechatlar "yechildi" deb belgilanadi va pul qoldig'i
 * 0'ga tushadi (append-only ledger — hech narsa o'chirilmaydi).
 */
export function ResetAllStampsDialog({ onDone }: { onDone?: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleConfirm() {
    setIsSubmitting(true);
    try {
      const result = await ledgerApi.resetAllStamps("Umumiy pechat tozalash");
      if (result.driversAffected === 0) {
        toast.info("Yechiladigan pechat topilmadi");
      } else {
        toast.success(
          `${result.driversAffected} ta haydovchida ${result.totalStampsRedeemed} ta pechat tozalandi`,
        );
      }
      if (result.failedDrivers.length > 0) {
        toast.error(
          `${result.failedDrivers.length} ta haydovchida xatolik yuz berdi`,
        );
      }
      onDone?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Pechatlarni tozalab bo'lmadi"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" /> : <Eraser />}
          Pechatlarni tozalash
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Barcha pechatlarni tozalash?</AlertDialogTitle>
          <AlertDialogDescription>
            Hamma haydovchining hozirgi yechilmagan pechatlari yechilgan deb
            belgilanadi va pul qoldig&apos;i 000&apos;ga tushadi. Haydovchi
            ma&apos;lumotlari (ism, telefon, mashina, rasm) o&apos;zgarmaydi,
            butun tarix saqlanib qoladi — bu amalni orqaga qaytarib
            bo&apos;lmaydi.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Bekor</AlertDialogCancel>
          <AlertDialogAction onClick={() => void handleConfirm()}>
            Tozalash
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

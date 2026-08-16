"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getApiErrorMessage } from "@/lib/api-client";
import { driversApi } from "@/lib/api/drivers";

export default function StaffQrPage() {
  const [signupUrl, setSignupUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    driversApi
      .getSelfRegisterLink()
      .then(({ token }) => {
        const url = `${window.location.origin}/royxat?k=${encodeURIComponent(token)}`;
        setSignupUrl(url);
      })
      .catch((err) => {
        setError(getApiErrorMessage(err, "QR kodni ochib bo'lmadi"));
      });
  }, []);

  const qrSrc = signupUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=10&ecc=H&data=${encodeURIComponent(signupUrl)}`
    : null;

  async function copyUrl() {
    if (!signupUrl) return;
    try {
      await navigator.clipboard.writeText(signupUrl);
      toast.success("Havola nusxalandi");
    } catch {
      toast.error("Nusxalanmadi");
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4 print:max-w-none">
      <div className="print:hidden">
        <h1 className="text-lg font-semibold">QR kod</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Shu kodni stolda qo&apos;ying. Haydovchi skaner qiladi va o&apos;zi
          yoziladi.
        </p>
      </div>

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="flex flex-col items-center gap-4 py-8">
          {!signupUrl && !error && (
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {qrSrc && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrSrc}
                alt="Ro'yxat QR kodi"
                width={280}
                height={280}
                className="size-[280px] rounded-xl bg-white p-2"
              />
              <p className="text-center font-display text-xl font-semibold text-[var(--brand-crust)]">
                Sanjar Patir
              </p>
              <p className="text-center text-sm text-muted-foreground">
                Kamerani oching, kodni skaner qiling, o&apos;zingizni yozing.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {signupUrl && (
        <div className="flex gap-2 print:hidden">
          <Button type="button" className="flex-1" onClick={() => window.print()}>
            <Printer className="size-4" />
            Chop etish
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={() => void copyUrl()}>
            <Copy className="size-4" />
            Havola
          </Button>
        </div>
      )}
    </div>
  );
}

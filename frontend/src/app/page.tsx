"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandLogo } from "@/components/brand/brand-logo";
import { useAuth } from "@/lib/auth-context";
import { getApiErrorMessage } from "@/lib/api-client";
import { staffEntryPath } from "@/lib/staff-routes";

export default function LoginPage() {
  const { status, claims, login } = useAuth();
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || !claims) return;
    if (claims.kind === "staff") router.replace(staffEntryPath(claims));
    if (claims.kind === "driver") router.replace("/driver/dashboard");
  }, [status, claims, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone || !password) {
      return;
    }
    setIsSubmitting(true);
    try {
      const next = await login(phone, password);
      router.push(
        next.kind === "staff" ? staffEntryPath(next) : "/driver/dashboard",
      );
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Telefon raqami yoki parol noto'g'ri"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-atmosphere relative flex min-h-svh flex-1 flex-col items-center justify-center px-5 py-10">
      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="relative size-[7.5rem] overflow-hidden rounded-full border-[3px] border-[var(--brand-gold)] bg-[var(--brand-gold-soft)]">
              <Image
                src="/brand/sanjar-patir-mark.png"
                alt=""
                fill
                className="object-cover"
                priority
                sizes="120px"
              />
            </div>
            <span className="steam steam-1" aria-hidden />
            <span className="steam steam-2" aria-hidden />
            <span className="steam steam-3" aria-hidden />
          </div>
          <BrandLogo variant="hero" animated />
        </div>

        <div className="login-panel w-full rounded-2xl border border-[var(--border)] bg-[rgb(255_253_248_/_0.92)] p-6 backdrop-blur-sm">
          <h1 className="sr-only">Tizimga kirish</h1>
          <p className="text-center text-sm text-muted-foreground">
            Telefon va parol bilan kiring
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefon raqami</Label>
              <Input
                id="phone"
                placeholder="+998 90 000 00 00"
                inputMode="tel"
                autoComplete="username"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="bg-white/80"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Parol</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white/80"
              />
            </div>
            <Button
              type="submit"
              className="w-full font-medium"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="animate-spin" />}
              Kirish
            </Button>
          </form>

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Chrome: menyu → &quot;Ilovani o&apos;rnatish&quot; / &quot;Add to Home
            screen&quot;. Pastdagi tugma chiqsa — shu orqali ham qo&apos;shish
            mumkin. Ikonda Sanjar Patir logosi bo&apos;ladi.
          </p>
        </div>
      </div>
    </main>
  );
}

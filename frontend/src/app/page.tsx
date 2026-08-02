"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { getApiErrorMessage } from "@/lib/api-client";

export default function LoginPage() {
  const { status, claims, login } = useAuth();
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (status !== "authenticated" || !claims) return;
    if (claims.kind === "staff") router.replace("/staff/dashboard");
    if (claims.kind === "driver") router.replace("/driver/dashboard");
  }, [status, claims, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phone || !password) {
      return;
    }
    setIsSubmitting(true);
    try {
      const kind = await login(phone, password);
      router.push(kind === "staff" ? "/staff/dashboard" : "/driver/dashboard");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Telefon raqami yoki parol noto'g'ri"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Lock className="size-5" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Sanjar Patir
          </p>
          <CardTitle>Tizimga kirish</CardTitle>
          <CardDescription>Haydovchilar sodiqlik va hamyon tizimi</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              Kirish
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

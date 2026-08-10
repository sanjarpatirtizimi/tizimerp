"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/brand-logo";
import { useAuth } from "@/lib/auth-context";

export function DriverShell({ children }: { children: React.ReactNode }) {
  const { logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[rgb(255_253_248_/_0.9)] px-4 backdrop-blur-md">
        <BrandLogo />
        <Button
          variant="ghost"
          size="icon"
          onClick={handleLogout}
          aria-label="Chiqish"
        >
          <LogOut className="size-4" />
        </Button>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

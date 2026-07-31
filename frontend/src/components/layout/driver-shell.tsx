"use client";

import { useRouter } from "next/navigation";
import { LogOut, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-4">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <Truck className="size-5" />
          Mening hamyonim
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout} aria-label="Chiqish">
          <LogOut className="size-4" />
        </Button>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

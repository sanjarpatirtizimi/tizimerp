"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Server,
  Package,
  UserCog,
  KeyRound,
  LogOut,
  Menu,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { ChangePasswordDialog } from "@/components/auth/change-password-dialog";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const primaryNav = [
  { href: "/staff/dashboard", label: "Bosh sahifa", icon: LayoutDashboard },
  { href: "/staff/drivers/new", label: "Ro'yxatga olish", icon: Users },
  { href: "/staff/devices", label: "Qurilmalar", icon: Server },
];

const superAdminNav = [
  { href: "/staff/analytics", label: "Statistika", icon: BarChart3 },
  { href: "/staff/products", label: "Mahsulotlar", icon: Package },
  { href: "/staff/users", label: "Operatorlar", icon: UserCog },
];

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Bosh administrator",
  OPERATOR: "Operator",
};

export function StaffShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { claims, logout } = useAuth();
  const isSuperAdmin = claims?.kind === "staff" && claims.role === "SUPER_ADMIN";

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background px-4">
        <Link href="/staff/dashboard" className="font-semibold tracking-tight">
          Sanjar Patir
        </Link>
        <div className="flex items-center gap-1">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {claims?.kind === "staff" ? roleLabels[claims.role] : ""}
          </span>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Menyu</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-2">
                {[...primaryNav, ...(isSuperAdmin ? superAdminNav : [])].map((item) => (
                  <SheetClose asChild key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent",
                        pathname === item.href && "bg-accent",
                      )}
                    >
                      <item.icon className="size-4" />
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
                <SheetClose asChild>
                  <ChangePasswordDialog
                    trigger={
                      <Button
                        variant="ghost"
                        className="mt-4 justify-start gap-3 px-3"
                      >
                        <KeyRound className="size-4" />
                        Parolni o&apos;zgartirish
                      </Button>
                    }
                  />
                </SheetClose>
                <SheetClose asChild>
                  <Button
                    variant="ghost"
                    className="justify-start gap-3 px-3 text-destructive hover:text-destructive"
                    onClick={handleLogout}
                  >
                    <LogOut className="size-4" />
                    Chiqish
                  </Button>
                </SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="flex-1 pb-20">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex h-16 items-center justify-around border-t bg-background">
        {primaryNav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium text-muted-foreground",
                active && "text-primary",
              )}
            >
              <item.icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

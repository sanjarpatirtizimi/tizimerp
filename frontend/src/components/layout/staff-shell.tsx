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
  BarChart3,
  Clock3,
  Flag,
  MessageSquareText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChangePasswordDialog } from "@/components/auth/change-password-dialog";
import { BrandLogo } from "@/components/brand/brand-logo";
import { useAuth } from "@/lib/auth-context";
import { staffEntryPath } from "@/lib/staff-routes";
import { cn } from "@/lib/utils";

const bottomNav = [
  { href: "/staff/dashboard", label: "Bosh sahifa", icon: LayoutDashboard },
  { href: "/staff/visits", label: "Kelishlar", icon: Clock3 },
  { href: "/staff/drivers/new", label: "Ro'yxat", icon: Users },
  { href: "/staff/devices", label: "Qurilmalar", icon: Server },
];

const sideNavAll = [
  { href: "/staff/flagged", label: "Qizil belgilar", icon: Flag },
  { href: "/staff/feedback", label: "Murojaatlar", icon: MessageSquareText },
];

const sideNavSuperAdmin = [
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
  const homeHref = staffEntryPath(claims);

  const sideNav = [
    ...sideNavAll,
    ...(isSuperAdmin ? sideNavSuperAdmin : []),
  ];

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[rgb(255_253_248_/_0.9)] px-4 pr-16 backdrop-blur-md">
        <Link href={homeHref} aria-label="Sanjar Patir">
          <BrandLogo />
        </Link>
        <span className="truncate text-xs text-muted-foreground">
          {claims?.kind === "staff" ? roleLabels[claims.role] : ""}
        </span>
      </header>

      {/* Right-edge icon rail — replaces hamburger; touch-friendly on phones */}
      <aside
        className="fixed top-14 right-0 bottom-16 z-20 flex w-14 flex-col items-center border-l border-[var(--border)] bg-[rgb(255_253_248_/_0.95)] py-2 backdrop-blur-md"
        aria-label="Tezkor menyu"
      >
        <nav className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto overscroll-contain px-1">
          {sideNav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                title={item.label}
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors active:scale-95",
                  active
                    ? "bg-primary/12 text-primary"
                    : "hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon className="size-5" />
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col items-center gap-1 border-t border-[var(--border)] px-1 pt-2">
          <ChangePasswordDialog
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 rounded-xl"
                aria-label="Parolni o'zgartirish"
                title="Parolni o'zgartirish"
              >
                <KeyRound className="size-5" />
              </Button>
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 rounded-xl text-destructive hover:text-destructive"
            aria-label="Chiqish"
            title="Chiqish"
            onClick={handleLogout}
          >
            <LogOut className="size-5" />
          </Button>
        </div>
      </aside>

      <main className="flex-1 pr-14 pb-20">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex h-16 items-center justify-around border-t bg-background pr-14">
        {bottomNav.map((item) => {
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
              <span className="max-w-[4.5rem] truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

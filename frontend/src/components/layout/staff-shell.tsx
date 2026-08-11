"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { KeyRound, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChangePasswordDialog } from "@/components/auth/change-password-dialog";
import { BrandLogo } from "@/components/brand/brand-logo";
import { useAuth } from "@/lib/auth-context";
import { staffEntryPath } from "@/lib/staff-routes";
import {
  isSuperAdminHomeHub,
  staffBottomNav,
  staffSideNavAll,
  staffSideNavSuperAdmin,
} from "@/lib/staff-nav";
import { cn } from "@/lib/utils";

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
  /** First screen: hub tiles in center; chrome nav returns on other pages. */
  const hubMode = isSuperAdmin && isSuperAdminHomeHub(pathname);

  const sideNav = [
    ...staffSideNavAll,
    ...(isSuperAdmin ? staffSideNavSuperAdmin : []),
  ];

  async function handleLogout() {
    await logout();
    router.push("/");
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header
        className={cn(
          "sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[var(--border)] bg-[rgb(255_253_248_/_0.9)] px-4 backdrop-blur-md",
          !hubMode && "pr-16",
        )}
      >
        <Link href={homeHref} aria-label="Sanjar Patir">
          <BrandLogo />
        </Link>
        <div className="flex items-center gap-1">
          <span className="truncate text-xs text-muted-foreground">
            {claims?.kind === "staff" ? roleLabels[claims.role] : ""}
          </span>
          {hubMode && (
            <>
              <ChangePasswordDialog
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Parolni o'zgartirish"
                    title="Parolni o'zgartirish"
                  >
                    <KeyRound className="size-4" />
                  </Button>
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                aria-label="Chiqish"
                title="Chiqish"
                onClick={handleLogout}
              >
                <LogOut className="size-4" />
              </Button>
            </>
          )}
        </div>
      </header>

      {!hubMode && (
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
      )}

      <main
        className={cn("flex-1", hubMode ? "pb-4" : "pr-14 pb-20")}
      >
        {children}
      </main>

      {!hubMode && (
        <nav className="fixed inset-x-0 bottom-0 z-20 flex h-16 items-center justify-around border-t bg-background pr-14">
          {staffBottomNav.map((item) => {
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
      )}
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { UserRole } from "@/lib/types";
import { Loader2 } from "lucide-react";

function FullscreenLoader() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export function RequireStaff({
  roles,
  children,
}: {
  roles?: UserRole[];
  children: React.ReactNode;
}) {
  const { status, claims } = useAuth();
  const router = useRouter();

  const isAuthorized =
    status === "authenticated" &&
    claims?.kind === "staff" &&
    (!roles || roles.includes(claims.role));

  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated" || claims?.kind !== "staff") {
      router.replace("/");
      return;
    }
    if (roles && !roles.includes(claims.role)) {
      router.replace("/staff/dashboard");
    }
  }, [status, claims, roles, router]);

  if (!isAuthorized) return <FullscreenLoader />;
  return <>{children}</>;
}

export function RequireDriver({ children }: { children: React.ReactNode }) {
  const { status, claims } = useAuth();
  const router = useRouter();

  const isAuthorized = status === "authenticated" && claims?.kind === "driver";

  useEffect(() => {
    if (status === "loading") return;
    if (status !== "authenticated" || claims?.kind !== "driver") {
      router.replace("/");
    }
  }, [status, claims, router]);

  if (!isAuthorized) return <FullscreenLoader />;
  return <>{children}</>;
}

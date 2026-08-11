"use client";

import { RequireDriver } from "@/components/auth/route-guard";
import { DriverShell } from "@/components/layout/driver-shell";
import { DriverAdPopup } from "@/components/ads/driver-ad-popup";

export default function DriverAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireDriver>
      <DriverShell>
        <DriverAdPopup />
        {children}
      </DriverShell>
    </RequireDriver>
  );
}

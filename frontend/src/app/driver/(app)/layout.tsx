"use client";

import { RequireDriver } from "@/components/auth/route-guard";
import { DriverShell } from "@/components/layout/driver-shell";
import { DriverAdPopup } from "@/components/ads/driver-ad-popup";
import { DriverAdSlideshowBanner } from "@/components/ads/driver-ad-slideshow-banner";

export default function DriverAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireDriver>
      <DriverShell>
        <DriverAdSlideshowBanner />
        <DriverAdPopup />
        {children}
      </DriverShell>
    </RequireDriver>
  );
}

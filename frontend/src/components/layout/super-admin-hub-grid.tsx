"use client";

import Link from "next/link";
import { LogoMark } from "@/components/brand/logo-mark";
import { superAdminHubTiles } from "@/lib/staff-nav";
import { cn } from "@/lib/utils";

/** Centered square shortcuts with large brand mark behind. */
export function SuperAdminHubGrid() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-[var(--border)] bg-[rgb(255_253_248_/_0.65)] px-3 py-5 sm:px-4">
      {/* Large logo watermark behind tiles */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden
      >
        <LogoMark className="size-[min(72vw,18rem)] opacity-[0.18] sm:size-72" />
      </div>
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[rgb(255_253_248_/_0.35)] to-[rgb(255_253_248_/_0.75)]"
        aria-hidden
      />

      <div className="relative z-10 space-y-3">
        <div className="text-center">
          <p className="font-display text-xl font-semibold tracking-tight text-[var(--brand-crust)]">
            Sanjar Patir
          </p>
          <p className="text-xs text-muted-foreground">
            Kerakli funksiyani bosing
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {superAdminHubTiles.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border border-white/70 bg-card/90 p-3 text-center shadow-sm backdrop-blur-[2px] transition-colors",
                "hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]",
              )}
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <item.icon className="size-5" />
              </span>
              <span className="line-clamp-2 text-[11px] font-medium leading-tight sm:text-xs">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import { cn } from "@/lib/utils";
import { LogoMark } from "./logo-mark";

type BrandLogoProps = {
  className?: string;
  /** compact = mark + wordmark for headers; hero = large login brand */
  variant?: "compact" | "hero";
  animated?: boolean;
};

export function BrandLogo({
  className,
  variant = "compact",
  animated = false,
}: BrandLogoProps) {
  if (variant === "hero") {
    return (
      <div className={cn("brand-hero flex flex-col items-center text-center", className)}>
        <div className="brand-hero-mark mb-3">
          <LogoMark animated={animated} className="size-14" />
        </div>
        <p className="font-display text-4xl font-semibold tracking-tight text-[var(--brand-crust)]">
          Sanjar Patir
        </p>
        <p className="mt-1 max-w-[16rem] text-sm text-[var(--brand-ink-muted)]">
          Haydovchilar sodiqlik va hamyon tizimi
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark animated={animated} className="size-8 shrink-0" />
      <span className="font-display text-lg font-semibold tracking-tight text-[var(--brand-crust)]">
        Sanjar Patir
      </span>
    </div>
  );
}

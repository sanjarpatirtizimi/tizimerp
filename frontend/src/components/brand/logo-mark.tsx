"use client";

import { cn } from "@/lib/utils";

/** Minimal chekich / patir mark — concentric stamp rings + warm crust arc. */
export function LogoMark({
  className,
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(animated && "logo-mark-animated", className)}
      aria-hidden
    >
      <circle cx="32" cy="32" r="30" className="fill-[var(--brand-gold-soft)]" />
      <circle
        cx="32"
        cy="32"
        r="22"
        className="stroke-[var(--brand-crust)]"
        strokeWidth="2.2"
        opacity="0.9"
      />
      <circle
        cx="32"
        cy="32"
        r="15"
        className="stroke-[var(--brand-crust)] logo-ring"
        strokeWidth="1.6"
        opacity="0.75"
      />
      <circle
        cx="32"
        cy="32"
        r="8"
        className="stroke-[var(--brand-crust)] logo-ring-inner"
        strokeWidth="1.4"
        opacity="0.65"
      />
      {/* Chekich / rising-sun ticks */}
      <g className="stroke-[var(--brand-ember)] logo-ticks" strokeWidth="1.8" strokeLinecap="round">
        <path d="M32 10v5" />
        <path d="M32 49v5" />
        <path d="M10 32h5" />
        <path d="M49 32h5" />
        <path d="M16.5 16.5l3.5 3.5" />
        <path d="M44 44l3.5 3.5" />
        <path d="M47.5 16.5l-3.5 3.5" />
        <path d="M20 44l-3.5 3.5" />
      </g>
      <circle cx="32" cy="32" r="2.8" className="fill-[var(--brand-ember)]" />
    </svg>
  );
}

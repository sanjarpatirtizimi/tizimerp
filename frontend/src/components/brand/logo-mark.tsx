"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

const MARK_SRC = "/brand/sanjar-patir-mark.png";

/** Brand mark — chef boy with patir (Sanjar Patir). */
export function LogoMark({
  className,
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative inline-block overflow-hidden rounded-full",
        animated && "logo-mark-animated",
        className,
      )}
      aria-hidden
    >
      <Image
        src={MARK_SRC}
        alt=""
        fill
        className="object-cover"
        sizes="(max-width: 768px) 40vw, 288px"
      />
    </span>
  );
}

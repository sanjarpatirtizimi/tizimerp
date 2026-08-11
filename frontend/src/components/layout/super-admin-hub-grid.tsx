"use client";

import Link from "next/link";
import { superAdminHubTiles } from "@/lib/staff-nav";
import { cn } from "@/lib/utils";

/** Centered square shortcuts on Super Admin first screen (statistika). */
export function SuperAdminHubGrid() {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Funksiyalar</h2>
        <p className="text-xs text-muted-foreground">
          Keraklisini bosing — ichkarida oddiy menyu ochiladi
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
        {superAdminHubTiles.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-2 rounded-2xl border bg-card p-3 text-center shadow-sm transition-colors",
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
    </section>
  );
}

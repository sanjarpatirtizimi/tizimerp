"use client";

import { useState } from "react";
import { Stamp, Banknote, Package, SlidersHorizontal, Flag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime, formatUzs } from "@/lib/format";
import type { Transaction, TransactionType } from "@/lib/types";
import { cn } from "@/lib/utils";

const typeMeta: Record<
  TransactionType,
  { icon: typeof Stamp; label: string; className: string }
> = {
  STAMP: {
    icon: Stamp,
    label: "Shtamp",
    className: "bg-success/15 text-success",
  },
  CASH_ADVANCE: {
    icon: Banknote,
    label: "Avans",
    className: "bg-amber-500/15 text-amber-600",
  },
  GOODS_EXCHANGE: {
    icon: Package,
    label: "Mahsulotga almashtirish",
    className: "bg-blue-500/15 text-blue-600",
  },
  MANUAL_ADJUSTMENT: {
    icon: SlidersHorizontal,
    label: "Tuzatish",
    className: "bg-purple-500/15 text-purple-600",
  },
};

function isFlaggedStamp(tx: Transaction): boolean {
  return (
    tx.type === "STAMP" && Boolean(tx.recognitionEvent?.isRedFlagged)
  );
}

export function TransactionList({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const [selected, setSelected] = useState<Transaction | null>(null);

  if (transactions.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Hozircha tranzaksiyalar yo&apos;q.
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y">
        {transactions.map((tx) => {
          const meta = typeMeta[tx.type];
          const amount = parseFloat(tx.amount);
          const Icon = meta.icon;
          const flagged = isFlaggedStamp(tx);

          return (
            <li key={tx.id}>
              <button
                type="button"
                disabled={!flagged}
                onClick={() => flagged && setSelected(tx)}
                className={cn(
                  "flex w-full items-center gap-3 py-3 text-left",
                  flagged && "cursor-pointer rounded-md hover:bg-destructive/5",
                  !flagged && "cursor-default",
                )}
              >
                <div
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full",
                    flagged
                      ? "bg-destructive/15 text-destructive"
                      : meta.className,
                  )}
                >
                  {flagged ? (
                    <Flag className="size-4 fill-current" />
                  ) : (
                    <Icon className="size-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p
                      className={cn(
                        "truncate text-sm font-medium",
                        flagged && "text-destructive",
                      )}
                    >
                      {meta.label}
                    </p>
                    {flagged && (
                      <Badge variant="destructive" className="text-[10px]">
                        Qizil
                      </Badge>
                    )}
                    {tx.operator && (
                      <Badge
                        variant="secondary"
                        className="hidden sm:inline-flex"
                      >
                        {tx.operator.fullName}
                      </Badge>
                    )}
                  </div>
                  {tx.description && (
                    <p className="truncate text-xs text-muted-foreground">
                      {tx.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(tx.createdAt)}
                    {flagged ? " · bosib izohni ko‘ring" : ""}
                  </p>
                </div>
                <p
                  className={cn(
                    "shrink-0 text-sm font-semibold tabular-nums",
                    flagged
                      ? "text-destructive"
                      : amount >= 0
                        ? "text-success"
                        : "text-destructive",
                  )}
                >
                  {amount >= 0 ? "+" : ""}
                  {formatUzs(amount)}
                </p>
              </button>
            </li>
          );
        })}
      </ul>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Qizil belgi — pechat
            </DialogTitle>
            <DialogDescription>
              Bu sotuv ({selected ? formatUzs(selected.amount) : ""}) uchun
              qizil belgi qo&apos;yilgan.
            </DialogDescription>
          </DialogHeader>
          {selected?.recognitionEvent && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Sabab / izoh
                </p>
                <p className="mt-1 whitespace-pre-wrap">
                  {selected.recognitionEvent.flagNote || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Kim belgilagan
                </p>
                <p className="mt-1">
                  {selected.recognitionEvent.flaggedBy?.fullName ??
                    "Noma'lum xodim"}
                </p>
              </div>
              {selected.recognitionEvent.flaggedAt && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Belgilanagan vaqt
                  </p>
                  <p className="mt-1">
                    {formatDateTime(selected.recognitionEvent.flaggedAt)}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

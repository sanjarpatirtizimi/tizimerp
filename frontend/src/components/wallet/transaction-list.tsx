"use client";

import { useState } from "react";
import {
  Stamp,
  Banknote,
  Package,
  SlidersHorizontal,
  Flag,
  CircleMinus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime, formatUzs } from "@/lib/format";
import type { StampRedeemKind, Transaction, TransactionType } from "@/lib/types";
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
  STAMP_REDEMPTION: {
    icon: CircleMinus,
    label: "Pechat yechish",
    className: "bg-muted text-muted-foreground",
  },
};

const redeemKindLabel: Record<StampRedeemKind, string> = {
  CASH: "Pulga",
  GOODS: "Mahsulotga / bronga",
  OTHER: "Boshqa",
};

function isFlaggedStamp(tx: Transaction): boolean {
  return (
    tx.type === "STAMP" &&
    !tx.redeemedAt &&
    Boolean(tx.recognitionEvent?.isRedFlagged)
  );
}

function isRedeemedStamp(tx: Transaction): boolean {
  return tx.type === "STAMP" && Boolean(tx.redeemedAt);
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
          const redeemed = isRedeemedStamp(tx);
          const clickable = flagged || redeemed;

          return (
            <li key={tx.id}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && setSelected(tx)}
                className={cn(
                  "flex w-full items-center gap-3 py-3 text-left",
                  flagged && "cursor-pointer rounded-md hover:bg-destructive/5",
                  redeemed && "cursor-pointer rounded-md hover:bg-muted/60",
                  !clickable && "cursor-default",
                  redeemed && "opacity-70",
                )}
              >
                <div
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full",
                    redeemed
                      ? "bg-muted text-muted-foreground grayscale"
                      : flagged
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
                        redeemed && "text-muted-foreground",
                      )}
                    >
                      {meta.label}
                    </p>
                    {flagged && (
                      <Badge variant="destructive" className="text-[10px]">
                        Qizil
                      </Badge>
                    )}
                    {redeemed && (
                      <Badge variant="secondary" className="text-[10px]">
                        Yechildi
                      </Badge>
                    )}
                    {tx.operator && !redeemed && (
                      <Badge
                        variant="secondary"
                        className="hidden sm:inline-flex"
                      >
                        {tx.operator.fullName}
                      </Badge>
                    )}
                  </div>
                  {tx.description && (
                    <p
                      className={cn(
                        "truncate text-xs text-muted-foreground",
                        redeemed && "line-through",
                      )}
                    >
                      {tx.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(tx.createdAt)}
                    {flagged ? " · bosib izohni ko‘ring" : ""}
                    {redeemed ? " · bosib yechish ma’lumotini ko‘ring" : ""}
                  </p>
                </div>
                <p
                  className={cn(
                    "shrink-0 text-sm font-semibold tabular-nums",
                    redeemed &&
                      "text-muted-foreground line-through decoration-2",
                    !redeemed &&
                      flagged &&
                      "text-destructive",
                    !redeemed &&
                      !flagged &&
                      (amount >= 0 ? "text-success" : "text-destructive"),
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
          {selected && isRedeemedStamp(selected) ? (
            <>
              <DialogHeader>
                <DialogTitle>Yechilgan pechat</DialogTitle>
                <DialogDescription>
                  Bu pechat ({formatUzs(selected.amount)}) yechib olingan —
                  balansdan ayirilgan.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Almashtirish turi
                  </p>
                  <p className="mt-1">
                    {selected.redeemKind
                      ? redeemKindLabel[selected.redeemKind]
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Izoh
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">
                    {selected.redeemNote || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Kim yechgan
                  </p>
                  <p className="mt-1">
                    {selected.redeemedBy?.fullName ?? "Noma'lum xodim"}
                  </p>
                </div>
                {selected.redeemedAt && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      Yechilgan vaqt
                    </p>
                    <p className="mt-1">
                      {formatDateTime(selected.redeemedAt)}
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

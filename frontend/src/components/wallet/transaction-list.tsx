import { Stamp, Banknote, Package, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatUzs } from "@/lib/format";
import type { Transaction, TransactionType } from "@/lib/types";
import { cn } from "@/lib/utils";

const typeMeta: Record<
  TransactionType,
  { icon: typeof Stamp; label: string; className: string }
> = {
  STAMP: { icon: Stamp, label: "Shtamp", className: "bg-success/15 text-success" },
  CASH_ADVANCE: { icon: Banknote, label: "Avans", className: "bg-amber-500/15 text-amber-600" },
  GOODS_EXCHANGE: { icon: Package, label: "Mahsulotga almashtirish", className: "bg-blue-500/15 text-blue-600" },
  MANUAL_ADJUSTMENT: {
    icon: SlidersHorizontal,
    label: "Tuzatish",
    className: "bg-purple-500/15 text-purple-600",
  },
};

export function TransactionList({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Hozircha tranzaksiyalar yo&apos;q.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {transactions.map((tx) => {
        const meta = typeMeta[tx.type];
        const amount = parseFloat(tx.amount);
        const Icon = meta.icon;

        return (
          <li key={tx.id} className="flex items-center gap-3 py-3">
            <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", meta.className)}>
              <Icon className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">{meta.label}</p>
                {tx.operator && (
                  <Badge variant="secondary" className="hidden sm:inline-flex">
                    {tx.operator.fullName}
                  </Badge>
                )}
              </div>
              {tx.description && (
                <p className="truncate text-xs text-muted-foreground">{tx.description}</p>
              )}
              <p className="text-xs text-muted-foreground">{formatDateTime(tx.createdAt)}</p>
            </div>
            <p
              className={cn(
                "shrink-0 text-sm font-semibold tabular-nums",
                amount >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {amount >= 0 ? "+" : ""}
              {formatUzs(amount)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

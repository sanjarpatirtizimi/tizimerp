import { Card, CardContent } from "@/components/ui/card";
import { formatUzs } from "@/lib/format";
import type { DriverBalanceSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BalanceCard({ summary }: { summary: DriverBalanceSummary }) {
  const balance = parseFloat(summary.balance);

  return (
    <Card className="overflow-hidden border-none bg-primary text-primary-foreground shadow-md">
      <CardContent className="space-y-6 py-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-primary-foreground/70">
            Joriy balans
          </p>
          <p
            className={cn(
              "text-3xl font-semibold tabular-nums",
              balance < 0 && "text-destructive-foreground",
            )}
          >
            {formatUzs(summary.balance)}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-primary-foreground/15 pt-4 text-sm">
          <Stat label="Yig'ilgan ballar" value={formatUzs(summary.totalStampPoints)} />
          <Stat label="Avanslar" value={formatUzs(summary.totalCashAdvances)} />
          <Stat label="Mahsulotlar" value={formatUzs(summary.totalGoodsExchanged)} />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-primary-foreground/70">{label}</p>
      <p className="truncate text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}

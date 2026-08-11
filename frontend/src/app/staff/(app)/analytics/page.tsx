"use client";

import { Children, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  Coins,
  Package,
  Stamp,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  CircleMinus,
} from "lucide-react";
import { RequireStaff } from "@/components/auth/route-guard";
import { SuperAdminHubGrid } from "@/components/layout/super-admin-hub-grid";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  analyticsApi,
  type AnalyticsDashboard,
  type DailyAnalyticsReport,
  type DriverBalanceRow,
  type DriverVisitRow,
  type InactiveDriverRow,
  type StaffAmountRow,
} from "@/lib/api/analytics";
import { formatDateTime, formatUzs } from "@/lib/format";
import { cn } from "@/lib/utils";

type StatsTab = "monthly" | "daily";

function currentMonthValue() {
  const now = new Date();
  // Approximate UZ business month selector (UTC+5)
  const uz = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  return `${uz.getUTCFullYear()}-${String(uz.getUTCMonth() + 1).padStart(2, "0")}`;
}

function currentDayValue() {
  const now = new Date();
  const uz = new Date(now.getTime() + 5 * 60 * 60 * 1000);
  return `${uz.getUTCFullYear()}-${String(uz.getUTCMonth() + 1).padStart(2, "0")}-${String(uz.getUTCDate()).padStart(2, "0")}`;
}

function monthOptions(count = 12) {
  const base = currentMonthValue();
  const [y0, m0] = base.split("-").map(Number);
  const options: string[] = [];
  for (let i = 0; i < count; i++) {
    let m = m0 - i;
    let y = y0;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    options.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return options;
}

function absenceLabel(days: number | null, neverVisited: boolean) {
  if (neverVisited) return "Hech qachon kelmagan";
  if (days == null) return "—";
  if (days >= 30) return `${days} kun (1 oy+)`;
  if (days >= 15) return `${days} kun (15+)`;
  if (days >= 10) return `${days} kun (10+)`;
  return `${days} kun`;
}

function formatClock(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tashkent",
  });
}

export default function AnalyticsPage() {
  return (
    <RequireStaff roles={["SUPER_ADMIN"]}>
      <AnalyticsPageContent />
    </RequireStaff>
  );
}

function AnalyticsPageContent() {
  const [tab, setTab] = useState<StatsTab>("monthly");
  const [month, setMonth] = useState(currentMonthValue);
  const [day, setDay] = useState(currentDayValue);
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [daily, setDaily] = useState<DailyAnalyticsReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dailyLoading, setDailyLoading] = useState(true);
  const options = useMemo(() => monthOptions(12), []);

  useEffect(() => {
    if (tab !== "monthly") return;
    let cancelled = false;
    setIsLoading(true);
    analyticsApi
      .dashboard(month)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, tab]);

  useEffect(() => {
    if (tab !== "daily") return;
    let cancelled = false;
    setDailyLoading(true);
    analyticsApi
      .daily(day)
      .then((res) => {
        if (!cancelled) setDaily(res);
      })
      .finally(() => {
        if (!cancelled) setDailyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [day, tab]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4">
      <SuperAdminHubGrid />

      <div className="space-y-3 border-t border-[var(--border)] pt-5">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="size-5" />
            Statistika
          </h1>
          <p className="text-sm text-muted-foreground">
            Oylik va kunlik hisobotlar
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-xl border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setTab("monthly")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              tab === "monthly"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <CalendarDays className="size-4" />
            Oylik hisobot
          </button>
          <button
            type="button"
            onClick={() => setTab("daily")}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              tab === "daily"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <CalendarClock className="size-4" />
            Kunlik hisobot
          </button>
        </div>
      </div>

      {tab === "monthly" ? (
        <MonthlyReport
          month={month}
          setMonth={setMonth}
          options={options}
          data={data}
          isLoading={isLoading}
        />
      ) : (
        <DailyReport
          day={day}
          setDay={setDay}
          data={daily}
          isLoading={dailyLoading}
        />
      )}
    </div>
  );
}

function DailyReport({
  day,
  setDay,
  data,
  isLoading,
}: {
  day: string;
  setDay: (v: string) => void;
  data: DailyAnalyticsReport | null;
  isLoading: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Kunlik hisobot</h2>
          <p className="text-xs text-muted-foreground">
            Oddiy kunlik ko‘rsatkichlar
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Sana
          <Input
            type="date"
            className="h-9 w-auto"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
      </div>

      {isLoading || !data ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <p className="text-sm font-medium text-muted-foreground">
            {data.period.label}
          </p>

          <section className="grid grid-cols-2 gap-3">
            <StatTile
              icon={Stamp}
              label="Pechatlar"
              value={String(data.summary.stampCount)}
              hint={`${data.summary.driversWhoVisited} haydovchi`}
            />
            <StatTile
              icon={Coins}
              label="Ballar"
              value={formatUzs(data.summary.stampPoints)}
            />
            <StatTile
              icon={Wallet}
              label="Avanslar"
              value={formatUzs(data.summary.cashAdvances)}
              hint={`${data.summary.cashAdvanceCount} ta`}
            />
            <StatTile
              icon={Package}
              label="Mahsulotlar"
              value={formatUzs(data.summary.goodsExchanged)}
              hint={`${data.summary.goodsCount} ta`}
            />
            <StatTile
              icon={CircleMinus}
              label="Pechat yechish"
              value={formatUzs(data.summary.stampRedemptions)}
              hint={`${data.summary.stampRedemptionCount} ta`}
              className="col-span-2"
            />
          </section>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Bugun kelganlar ({data.visits.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pb-3">
              {data.visits.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Bu kunda pechat yo‘q
                </p>
              ) : (
                data.visits.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center gap-3 rounded-md px-1 py-2.5 hover:bg-muted/50"
                  >
                    <div className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-muted text-[10px] font-semibold leading-tight text-muted-foreground">
                      <span>{formatClock(row.createdAt)}</span>
                    </div>
                    <DriverLink
                      id={row.driverId}
                      name={row.fullName}
                      meta={[row.phone, row.carPlate].filter(Boolean).join(" · ")}
                    />
                    <span className="shrink-0 text-sm font-semibold text-emerald-700">
                      +{formatUzs(row.amount)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function MonthlyReport({
  month,
  setMonth,
  options,
  data,
  isLoading,
}: {
  month: string;
  setMonth: (v: string) => void;
  options: string[];
  data: AnalyticsDashboard | null;
  isLoading: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Oylik hisobot</h2>
          <p className="text-xs text-muted-foreground">
            Reytinglar va oylik yig‘indi
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Oy
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm text-foreground"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading || !data ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile
              icon={Users}
              label="Tashriflar"
              value={String(data.monthly.visitCount)}
              hint={`${data.monthly.driversWhoVisited} haydovchi`}
            />
            <StatTile
              icon={Coins}
              label="Ballar"
              value={formatUzs(data.monthly.totalStampPoints)}
            />
            <StatTile
              icon={Wallet}
              label="Avanslar"
              value={formatUzs(data.monthly.totalCashAdvances)}
            />
            <StatTile
              icon={Package}
              label="Mahsulotlar"
              value={formatUzs(data.monthly.totalGoodsExchanged)}
            />
            <StatTile
              icon={TrendingUp}
              label="Jami plyus balans"
              value={formatUzs(data.totals.totalPositiveBalances)}
              hint={`${data.totals.driversWithPositiveBalance} haydovchi`}
              className="col-span-2 sm:col-span-1"
            />
            <StatTile
              icon={TrendingDown}
              label="Jami qarz"
              value={formatUzs(data.totals.totalDebtAbs)}
              hint={`${data.totals.driversWithDebt} haydovchi`}
            />
          </section>

          <RankingCard
            title="Ko'p puli bor haydovchilar"
            empty="Plyus balansli haydovchi yo'q"
          >
            {data.rankings.mostMoney.map((row, i) => (
              <BalanceRankRow key={row.driverId} rank={i + 1} row={row} positive />
            ))}
          </RankingCard>

          <RankingCard
            title="Ko'p qarzi bor haydovchilar"
            empty="Qarzdor haydovchi yo'q"
          >
            {data.rankings.mostDebt.map((row, i) => (
              <BalanceRankRow key={row.driverId} rank={i + 1} row={row} />
            ))}
          </RankingCard>

          <RankingCard
            title={`Eng ko'p kelganlar (${data.period.label})`}
            empty="Bu oyda tashrif yo'q"
          >
            {data.rankings.mostVisits.map((row, i) => (
              <VisitRankRow key={row.driverId} rank={i + 1} row={row} />
            ))}
          </RankingCard>

          <RankingCard
            title={`Ko'p avans bergan xodimlar (${data.period.label})`}
            empty="Bu oyda avans berilmagan"
          >
            {data.staffRankings.mostAdvances.map((row, i) => (
              <StaffRankRow key={row.operatorId} rank={i + 1} row={row} />
            ))}
          </RankingCard>

          <RankingCard
            title={`Ko'p mahsulot bergan xodimlar (${data.period.label})`}
            empty="Bu oyda mahsulot berilmagan"
          >
            {data.staffRankings.mostGoods.map((row, i) => (
              <StaffRankRow key={row.operatorId} rank={i + 1} row={row} />
            ))}
          </RankingCard>

          <RankingCard
            title="Uzoq vaqtdan beri kelmaganlar"
            empty="7+ kun kelmagan haydovchi yo'q"
            icon={<CalendarClock className="size-4" />}
          >
            {data.inactiveDrivers.map((row, i) => (
              <InactiveRankRow key={row.driverId} rank={i + 1} row={row} />
            ))}
          </RankingCard>
        </>
      )}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <Card className={cn(className)}>
      <CardContent className="space-y-1 py-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="size-3.5" />
          {label}
        </div>
        <p className="text-base font-semibold leading-tight">{value}</p>
        {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function RankingCard({
  title,
  empty,
  children,
  icon,
}: {
  title: string;
  empty: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  const hasItems = Children.count(children) > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 pb-3">
        {hasItems ? (
          children
        ) : (
          <p className="py-4 text-center text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}

function RankPrefix({ rank }: { rank: number }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
      {rank}
    </span>
  );
}

function DriverLink({
  id,
  name,
  meta,
}: {
  id: string;
  name: string;
  meta?: string | null;
}) {
  return (
    <div className="min-w-0 flex-1">
      <Link
        href={`/staff/drivers/${id}`}
        className="truncate font-medium hover:underline"
      >
        {name}
      </Link>
      {meta ? (
        <p className="truncate text-xs text-muted-foreground">{meta}</p>
      ) : null}
    </div>
  );
}

function BalanceRankRow({
  rank,
  row,
  positive,
}: {
  rank: number;
  row: DriverBalanceRow;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md px-1 py-2 hover:bg-muted/50">
      <RankPrefix rank={rank} />
      <DriverLink
        id={row.driverId}
        name={row.fullName}
        meta={[row.phone, row.carPlate].filter(Boolean).join(" · ")}
      />
      <span
        className={cn(
          "shrink-0 text-sm font-semibold",
          positive ? "text-emerald-700" : "text-destructive",
        )}
      >
        {formatUzs(row.balance)}
      </span>
    </div>
  );
}

function VisitRankRow({ rank, row }: { rank: number; row: DriverVisitRow }) {
  return (
    <div className="flex items-center gap-3 rounded-md px-1 py-2 hover:bg-muted/50">
      <RankPrefix rank={rank} />
      <DriverLink
        id={row.driverId}
        name={row.fullName}
        meta={[row.phone, row.carPlate].filter(Boolean).join(" · ")}
      />
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold">{row.visitCount} marta</p>
        <p className="text-[11px] text-muted-foreground">
          {formatUzs(row.stampPoints)}
        </p>
      </div>
    </div>
  );
}

function StaffRankRow({ rank, row }: { rank: number; row: StaffAmountRow }) {
  return (
    <div className="flex items-center gap-3 rounded-md px-1 py-2 hover:bg-muted/50">
      <RankPrefix rank={rank} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{row.fullName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {row.phone} · {row.count} ta operatsiya
        </p>
      </div>
      <span className="shrink-0 text-sm font-semibold">
        {formatUzs(row.totalAmount)}
      </span>
    </div>
  );
}

function InactiveRankRow({
  rank,
  row,
}: {
  rank: number;
  row: InactiveDriverRow;
}) {
  const days = row.daysSinceVisit ?? 0;
  const tone =
    row.neverVisited || days >= 30
      ? "destructive"
      : days >= 15
        ? "secondary"
        : "outline";

  return (
    <div className="flex items-center gap-3 rounded-md px-1 py-2 hover:bg-muted/50">
      <RankPrefix rank={rank} />
      <DriverLink
        id={row.driverId}
        name={row.fullName}
        meta={
          row.lastVisitAt
            ? `Oxirgi: ${formatDateTime(row.lastVisitAt)}`
            : row.phone
        }
      />
      <Badge variant={tone} className="shrink-0">
        {absenceLabel(row.daysSinceVisit, row.neverVisited)}
      </Badge>
    </div>
  );
}

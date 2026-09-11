"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock,
  Loader2,
  Radio,
  RefreshCw,
  Settings2,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  relayAgentsApi,
  type AgentConfig,
  type AgentInfo,
  type AgentLog,
} from "@/lib/api/relay-agents";
import { cn } from "@/lib/utils";

// ─── helpers ────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return "hech qachon";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "hozirgina";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} daqiqa oldin`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} soat oldin`;
  return `${Math.floor(ms / 86_400_000)} kun oldin`;
}

function shortTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const logLevelStyle: Record<string, string> = {
  info: "text-[var(--brand-ink-muted)]",
  warn: "text-amber-600",
  error: "text-red-600",
};

const logLevelDot: Record<string, string> = {
  info: "bg-emerald-400",
  warn: "bg-amber-400",
  error: "bg-red-500",
};

// ─── LogViewer ──────────────────────────────────────────────────────────────

function LogViewer({ deviceId, onClose }: { deviceId: string; onClose: () => void }) {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await relayAgentsApi.getLogs(deviceId, 150);
      setLogs(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => void fetchLogs(), 4000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchLogs]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  async function handleClear() {
    setClearing(true);
    try {
      const res = await relayAgentsApi.clearLogs(deviceId);
      toast.success(`${res.cleared} ta log o'chirildi`);
      setLogs([]);
    } catch (e) {
      toast.error(getApiErrorMessage(e, "O'chirib bo'lmadi"));
    } finally {
      setClearing(false);
    }
  }

  const displayedLogs = [...logs].reverse();

  return (
    <div className="flex flex-col gap-3">
      {/* toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "size-2 rounded-full",
              autoRefresh ? "animate-pulse bg-emerald-400" : "bg-muted-foreground/30",
            )}
          />
          <span className="text-xs text-muted-foreground">
            {autoRefresh ? "Jonli — har 4 soniyada yangilanadi" : "To'xtatilgan"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs"
            onClick={() => setAutoRefresh((p) => !p)}
          >
            {autoRefresh ? (
              <>
                <X className="size-3" /> To'xtat
              </>
            ) : (
              <>
                <Activity className="size-3" /> Jonli
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs"
            onClick={() => void fetchLogs()}
          >
            <RefreshCw className="size-3" /> Yangilash
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
            disabled={clearing || logs.length === 0}
            onClick={() => void handleClear()}
          >
            {clearing ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
            Tozalash
          </Button>
        </div>
      </div>

      {/* log list */}
      <div className="max-h-[420px] overflow-y-auto rounded-xl border border-[var(--border)] bg-[#1a1208] p-3 font-mono text-xs">
        {loading ? (
          <p className="text-center text-muted-foreground/60 py-6">Yuklanmoqda…</p>
        ) : displayedLogs.length === 0 ? (
          <p className="text-center text-muted-foreground/60 py-6">
            Loglar yo'q — agent ishga tushgandan so'ng bu yerda ko'rinadi
          </p>
        ) : (
          displayedLogs.map((log) => (
            <div key={log.id} className="flex gap-2 py-0.5 leading-relaxed">
              <span
                className={cn(
                  "mt-1.5 size-1.5 shrink-0 rounded-full",
                  logLevelDot[log.level] ?? "bg-muted-foreground",
                )}
              />
              <span className="shrink-0 text-[var(--brand-ink-muted)]/50">
                {shortTime(log.createdAt)}
              </span>
              <span
                className={cn(
                  "break-words",
                  logLevelStyle[log.level] ?? "text-[var(--brand-ink-muted)]",
                  log.level === "error" && "font-medium",
                )}
              >
                {log.message}
              </span>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {logs.length > 0 && (
        <p className="text-right text-[10px] text-muted-foreground">
          {logs.length} ta log ko'rsatilmoqda
        </p>
      )}
    </div>
  );
}

// ─── ConfigPanel ─────────────────────────────────────────────────────────────

function ConfigPanel({ agent }: { agent: AgentInfo }) {
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AgentConfig>(
    agent.agentConfig ?? { stampPollEnabled: true, pollIntervalMs: 1000, stampIntervalMs: 2000 },
  );

  async function handleSave() {
    setSaving(true);
    try {
      await relayAgentsApi.setConfig(agent.id, config);
      toast.success("Sozlamalar saqlandi — agent keyingi heartbeatda qabul qiladi");
    } catch (e) {
      toast.error(getApiErrorMessage(e, "Saqlab bo'lmadi"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--brand-flour)] p-4 space-y-4">
        {/* Stamp toggle */}
        <div className="flex items-center gap-3">
          <Checkbox
            id="stampPoll"
            checked={config.stampPollEnabled ?? true}
            onCheckedChange={(v) =>
              setConfig((c) => ({ ...c, stampPollEnabled: Boolean(v) }))
            }
          />
          <div>
            <Label htmlFor="stampPoll" className="text-sm font-medium cursor-pointer">
              Pechat o'qish yoqilgan
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Face ID dan avtomatik kelish pechati o'qilsinmi?
            </p>
          </div>
        </div>

        {/* Poll interval */}
        <div className="space-y-1.5">
          <Label className="text-sm">Tekshirish oralig'i (ms)</Label>
          <p className="text-xs text-muted-foreground">
            Serverda yangi haydovchi borligini qancha vaqtda bir tekshirsin. Odatda: 1000
          </p>
          <Input
            type="number"
            min={500}
            max={30000}
            step={500}
            value={config.pollIntervalMs ?? 1000}
            onChange={(e) =>
              setConfig((c) => ({ ...c, pollIntervalMs: Number(e.target.value) }))
            }
            className="w-36 bg-white/70"
          />
        </div>

        {/* Stamp interval */}
        <div className="space-y-1.5">
          <Label className="text-sm">Pechat oralig'i (ms)</Label>
          <p className="text-xs text-muted-foreground">
            Face ID dan pechat ma'lumotlarini qancha vaqtda bir o'qisin. Odatda: 2000
          </p>
          <Input
            type="number"
            min={500}
            max={30000}
            step={500}
            value={config.stampIntervalMs ?? 2000}
            onChange={(e) =>
              setConfig((c) => ({ ...c, stampIntervalMs: Number(e.target.value) }))
            }
            className="w-36 bg-white/70"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        💡 Sozlamalar agent keyingi 30 soniyada server bilan bog'langanda avtomatik qabul qilinadi.
        Agent qayta ishga tushirish shart emas.
      </p>

      <Button onClick={() => void handleSave()} disabled={saving} size="sm">
        {saving && <Loader2 className="size-3 animate-spin" />}
        Sozlamalarni saqlash
      </Button>
    </div>
  );
}

// ─── AgentCard ───────────────────────────────────────────────────────────────

function AgentCard({ agent }: { agent: AgentInfo }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<"logs" | "config">("logs");

  return (
    <Card
      className={cn(
        "border transition-all",
        agent.isOnline
          ? "border-emerald-300/60 bg-emerald-50/30"
          : "border-[var(--border)] bg-white/40",
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          {/* Left: status + name */}
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 shrink-0">
              {agent.isOnline ? (
                <div className="relative">
                  <CheckCircle2 className="size-5 text-emerald-500" />
                  <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
              ) : (
                <WifiOff className="size-5 text-muted-foreground/50" />
              )}
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base leading-tight">{agent.name}</CardTitle>
              {agent.location && (
                <p className="text-xs text-muted-foreground mt-0.5">{agent.location}</p>
              )}
              {agent.lastLog && (
                <p
                  className={cn(
                    "text-xs mt-1 truncate max-w-xs",
                    logLevelStyle[agent.lastLog.level] ?? "text-muted-foreground",
                  )}
                >
                  {agent.lastLog.message}
                </p>
              )}
            </div>
          </div>

          {/* Right: badges + expand */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex flex-col items-end gap-1">
              <Badge
                className={cn(
                  "text-[10px] px-1.5 py-0",
                  agent.isOnline
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                    : "bg-muted/40 text-muted-foreground",
                )}
                variant="outline"
              >
                {agent.isOnline ? "ONLAYN" : "OFLAYN"}
              </Badge>
              {agent.agentVersion && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  v{agent.agentVersion}
                </span>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 shrink-0"
              onClick={() => setExpanded((p) => !p)}
              aria-label={expanded ? "Yopish" : "Ochish"}
            >
              {expanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 pl-8">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="size-3" />
            {timeAgo(agent.agentLastSeenAt)}
          </span>
          {agent.agentVersion && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground sm:hidden">
              <CircleDot className="size-3" />
              v{agent.agentVersion}
            </span>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {/* Tabs */}
          <div className="flex gap-1 mb-4 border-b border-[var(--border)]">
            <button
              onClick={() => setTab("logs")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                tab === "logs"
                  ? "border-[var(--brand-ember)] text-[var(--brand-ember)]"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Activity className="size-3.5" />
              Loglar
            </button>
            <button
              onClick={() => setTab("config")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                tab === "config"
                  ? "border-[var(--brand-ember)] text-[var(--brand-ember)]"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Settings2 className="size-3.5" />
              Sozlamalar
            </button>
          </div>

          {tab === "logs" ? (
            <LogViewer deviceId={agent.id} onClose={() => setExpanded(false)} />
          ) : (
            <ConfigPanel agent={agent} />
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAgents = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await relayAgentsApi.list();
      setAgents(data);
    } catch {
      if (!silent) toast.error("Relay agentlarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchAgents();
    const id = setInterval(() => void fetchAgents(true), 30_000);
    return () => clearInterval(id);
  }, [fetchAgents]);

  const onlineCount = agents.filter((a) => a.isOnline).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Sanjar Patir logo mark */}
          <div className="relative size-10 shrink-0 overflow-hidden rounded-full border-2 border-[var(--brand-gold)] bg-[var(--brand-gold-soft)]">
            <Image
              src="/brand/sanjar-patir-mark.png"
              alt="Sanjar Patir"
              fill
              className="object-cover"
              sizes="40px"
            />
          </div>
          <div>
            <h1 className="font-display text-xl font-semibold text-[var(--brand-crust)]">
              Relay Agentlar
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Masofadan boshqarish va monitoring
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void fetchAgents(true)}
          disabled={refreshing}
          className="shrink-0"
        >
          {refreshing ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Yangilash
        </Button>
      </div>

      {/* ─── Summary bar ─── */}
      {!loading && agents.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <SummaryTile
            icon={<Radio className="size-4" />}
            label="Jami agentlar"
            value={agents.length}
            color="default"
          />
          <SummaryTile
            icon={<CheckCircle2 className="size-4" />}
            label="Onlayn"
            value={onlineCount}
            color="success"
          />
          <SummaryTile
            icon={<WifiOff className="size-4" />}
            label="Oflayn"
            value={agents.length - onlineCount}
            color={agents.length - onlineCount > 0 ? "warn" : "default"}
          />
        </div>
      )}

      {/* ─── Agent cards ─── */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      {/* ─── Footer info ─── */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--brand-gold-soft)]/40 p-4 space-y-2">
        <p className="text-sm font-medium text-[var(--brand-crust)]">
          🔌 Relay agent nima?
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Relay agent — gate kompyuterida yoki planshetda ishlaydigan kichik dastur. U Face ID qurilmasi 
          bilan bir xil tarmoqda bo'lib, yangi haydovchilarni Face ID ga avtomatik yozadi va 
          kelish pechati ma'lumotlarini serverga yuboradi. Bu sahifada barcha agentlarni 
          masofadan kuzatib, loglarini ko'rib va sozlamalarini o'zgartirish mumkin.
        </p>
        <p className="text-xs text-muted-foreground">
          💡 Agent 3 daqiqadan ko'proq vaqt bog'lanmasa "Oflayn" hisoblanadi.
        </p>
      </div>
    </div>
  );
}

// ─── SummaryTile ─────────────────────────────────────────────────────────────

function SummaryTile({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "default" | "success" | "warn";
}) {
  const colorCls = {
    default: "bg-white/60 border-[var(--border)]",
    success: "bg-emerald-50/60 border-emerald-200/60",
    warn: "bg-amber-50/60 border-amber-200/60",
  }[color];

  const textCls = {
    default: "text-[var(--brand-ink)]",
    success: "text-emerald-700",
    warn: "text-amber-700",
  }[color];

  return (
    <div className={cn("rounded-xl border p-3 flex flex-col gap-1", colorCls)}>
      <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", textCls)}>
        {icon}
        <span>{label}</span>
      </div>
      <span className={cn("text-2xl font-bold tabular-nums", textCls)}>{value}</span>
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="relative size-16 overflow-hidden rounded-full border-2 border-[var(--brand-gold)] bg-[var(--brand-gold-soft)]">
        <Image
          src="/brand/sanjar-patir-mark.png"
          alt="Sanjar Patir"
          fill
          className="object-cover opacity-60"
          sizes="64px"
        />
      </div>
      <div>
        <p className="font-medium text-[var(--brand-crust)]">Relay agentlar topilmadi</p>
        <p className="mt-1 text-sm text-muted-foreground max-w-xs">
          Qurilmalar sahifasida qurilmaga Agent kaliti yaratilganidan so'ng bu yerda ko'rinadi.
          Agent ishga tushgandan keyin 30 soniya ichida onlayn bo'ladi.
        </p>
      </div>
    </div>
  );
}

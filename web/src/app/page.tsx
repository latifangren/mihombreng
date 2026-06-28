"use client";

import { useMihomoStatus } from "@/hooks/use-mihomo-status";
import { useMihomoStats } from "@/hooks/use-mihomo-stats";
import { StatusCard } from "@/components/status/status-card";
import { Card } from "@/components/ui/card";
import { DataState } from "@/components/ui/data-state";
import { RetroBtn } from "@/components/ui/retro-btn";
import { Terminal } from "@/components/terminal/terminal";
import { SkeletonCard, SkeletonStatBox, Skeleton } from "@/components/ui/skeleton";
import { formatBytes, formatDuration, formatTraffic } from "@/utils/format";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Cpu,
  FileText,
  Globe,
  MemoryStick as Memory,
  Network,
  RefreshCcw,
  Shield,
  Sliders,
  TerminalSquare,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Navigation cards                                                  */
/* ------------------------------------------------------------------ */
const navCards = [
  { to: "/traffic", label: "Traffic", desc: "Live bandwidth and proxy flow", icon: Activity },
  { to: "/connections", label: "Connections", desc: "Active network sessions", icon: Network },
  { to: "/diagnostics", label: "Diagnostics", desc: "System health and connectivity checks", icon: Shield },
  { to: "/logs", label: "Logs", desc: "Mihomo log stream", icon: FileText },
  { to: "/profiles", label: "Profiles", desc: "Rule and proxy group management", icon: Sliders },
  { to: "/providers", label: "Providers", desc: "Remote subscription sources", icon: Globe },
] as const;

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                  */
/* ------------------------------------------------------------------ */
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-[16px] border-2 border-black bg-surface p-5 shadow-[8px_8px_0_#000]">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-36" />
        </div>
        <Skeleton className="mt-3 h-4 w-64" />
        <div className="mt-5 flex gap-6">
          <Skeleton className="h-12 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SkeletonStatBox key="stat-a" />
        <SkeletonStatBox key="stat-b" />
        <SkeletonStatBox key="stat-c" />
        <SkeletonStatBox key="stat-d" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard key="nav-a" />
        <SkeletonCard key="nav-b" />
        <SkeletonCard key="nav-c" />
        <SkeletonCard key="nav-d" />
        <SkeletonCard key="nav-e" />
        <SkeletonCard key="nav-f" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard                                                         */
/* ------------------------------------------------------------------ */
export default function DashboardPage() {
  const { status, loading, error: statusError, refetch } = useMihomoStatus();
  const { stats, error: statsError } = useMihomoStats();
  const navigate = useNavigate();

  const isRunning = status.running;
  const isDegraded = isRunning && Boolean(statusError);
  const isOffline = !isRunning;

  /* Posture */
  const posture = isOffline ? "System Offline" : isDegraded ? "Degraded" : "System Online";
  const postureTone = isOffline ? "text-danger" : isDegraded ? "text-warning" : "text-primary";
  const postureDot = isOffline ? "bg-danger" : isDegraded ? "bg-warning animate-pulse" : "bg-primary";
  const readinessLabel = statusError ? "Status poll failed" : isOffline ? "Core stopped" : "Status poll live";
  const readinessDot = statusError ? "bg-danger" : isOffline ? "bg-warning" : "bg-primary";

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-[16px] border-2 border-black bg-surface p-5 shadow-[8px_8px_0_#000]">
        <div className="absolute right-[-60px] top-[-80px] h-44 w-44 rounded-full border-2 border-black bg-primary/10" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl uppercase tracking-wide text-text">Dashboard</h1>
              <span
                className="inline-flex items-center gap-2 rounded-full border-2 border-black bg-background px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-text-muted"
                title={statusError || undefined}
              >
                <span className={`h-2 w-2 rounded-full ${readinessDot}`} />
                {readinessLabel}
              </span>
            </div>
            <p className="mt-2 font-mono text-xs uppercase tracking-wider text-text-muted">
              System overview and operational status
            </p>
            <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Posture</p>
                <div className="flex items-center gap-3">
                  <span className={`h-3 w-3 rounded-full ${postureDot}`} />
                  <p className={`font-heading text-4xl uppercase tracking-wide ${postureTone}`}>{posture}</p>
                </div>
              </div>
              {status.version && (
                <div className="pb-1">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Version</p>
                  <p className="font-heading text-lg text-text">{status.version}</p>
                </div>
              )}
              {status.uptime && (
                <div className="pb-1">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Uptime</p>
                  <p className="font-heading text-lg text-text">{formatDuration(status.uptime)}</p>
                </div>
              )}
            </div>
          </div>
          <RetroBtn variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCcw className="mr-1.5 inline-block h-3.5 w-3.5" />
            Refresh
          </RetroBtn>
        </div>
      </div>

      {statusError && (
        <DataState
          tone="danger"
          title="Status fetch failed"
          message={statusError}
          action={<RetroBtn size="sm" variant="ghost" onClick={() => refetch()} loading={loading}>Retry</RetroBtn>}
        />
      )}

      {statsError && (
        <DataState
          tone="warning"
          title="Stats polling interrupted"
          message={statsError}
        />
      )}

      {/* ── Quick Stats ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatusCard
          label="Memory"
          value={`${formatBytes(stats.memory.inuse)}${stats.memory.oslimit > 0 ? ` / ${formatBytes(stats.memory.oslimit)}` : ""}`}
          icon={<Memory className="h-4 w-4" />}
          variant={stats.memory.oslimit > 0 && stats.memory.inuse / stats.memory.oslimit > 0.85 ? "danger" : "info"}
        />
        <StatusCard
          label="Traffic"
          value={
            <span className="flex flex-col leading-tight">
              <span className="text-sm">↓ {formatTraffic(stats.traffic.down)}</span>
              <span className="text-sm text-text-muted">↑ {formatTraffic(stats.traffic.up)}</span>
            </span>
          }
          icon={<Globe className="h-4 w-4" />}
          variant="info"
        />
        <StatusCard
          label="Connections"
          value={String(stats.connections)}
          icon={<Network className="h-4 w-4" />}
          variant={stats.connections > 500 ? "warning" : "success"}
        />
        <StatusCard
          label="CPU"
          value={status.cpu != null ? `${(status.cpu * 100).toFixed(1)}%` : "—"}
          icon={<Cpu className="h-4 w-4" />}
          variant={status.cpu != null && status.cpu > 0.8 ? "danger" : "success"}
        />
      </div>

      {/* ── Navigation + System Context ── */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
        {/* Quick nav */}
        <div className="space-y-4">
          <h2 className="font-heading text-xs uppercase tracking-widest text-text-muted">Quick Navigation</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {navCards.map((card) => (
              <button
                key={card.to}
                type="button"
                onClick={() => navigate(card.to)}
                className="group flex items-start gap-3 rounded-[12px] border-2 border-black bg-surface p-4 text-left shadow-[4px_4px_0_#000] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#000]"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border-2 border-black bg-black/10 group-hover:bg-primary/15">
                  <card.icon className="h-4 w-4 text-text-muted group-hover:text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-heading text-sm uppercase tracking-wide text-text group-hover:text-primary">
                    {card.label}
                    <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-text-muted">{card.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* System context */}
        <div className="space-y-4">
          <h2 className="font-heading text-xs uppercase tracking-widest text-text-muted">System Context</h2>
          <Card title="Mihomo Runtime" icon={<TerminalSquare className="h-4 w-4" />}>
            <Terminal className="w-full" title="mihomo status">
              <div className="space-y-1.5 font-mono text-xs leading-5">
                <div className="flex items-center gap-2">
                  <span className={isRunning ? "text-primary" : "text-danger"}>
                    {isRunning ? "●" : "○"}
                  </span>
                  <span>
                    Mihomo {isRunning ? "running" : "stopped"}
                    {status.version ? ` — ${status.version}` : ""}
                  </span>
                </div>
                {status.uptime != null && status.uptime > 0 && (
                  <div className="text-text-muted">
                    Uptime: {formatDuration(status.uptime)}
                  </div>
                )}
                <div className="text-text-muted">
                  Memory: {formatBytes(stats.memory.inuse)}
                  {stats.memory.oslimit > 0 ? ` / ${formatBytes(stats.memory.oslimit)}` : ""}
                </div>
                {status.cpu != null && (
                  <div className="text-text-muted">
                    CPU: {(status.cpu * 100).toFixed(1)}%
                  </div>
                )}
                <div className="text-text-muted">
                  Connections: {stats.connections}
                </div>
                <div className="text-text-muted">
                  Traffic: ↓ {formatTraffic(stats.traffic.down)} / ↑ {formatTraffic(stats.traffic.up)}
                </div>
                {statusError && (
                  <div className="mt-2 border-t border-[#1a1a1a] pt-2 text-danger">
                    {statusError}
                  </div>
                )}
                <div className="terminal-cursor mt-2 inline-block text-primary" />
              </div>
            </Terminal>
          </Card>
        </div>
      </div>
    </div>
  );
}

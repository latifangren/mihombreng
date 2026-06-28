"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { RetroBtn } from "@/components/ui/retro-btn";
import { DataState, FreshnessPill } from "@/components/ui/data-state";
import { Terminal } from "@/components/terminal/terminal";
import { Skeleton } from "@/components/ui/skeleton";
import { useMihomoStatus } from "@/hooks/use-mihomo-status";
import { mihomoApi } from "@/services/api";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  ExternalLink,
  FileCode,
  Info,
  Play,
  Power,
  RefreshCcw,
  Shield,
  Square,
  TerminalSquare,
} from "lucide-react";
import toast from "react-hot-toast";
import type { DashboardInfo } from "@/types";
import { formatBytes, formatDuration } from "@/utils/format";

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                  */
/* ------------------------------------------------------------------ */
function MihomoSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-[16px] border-2 border-black bg-surface p-5 shadow-[8px_8px_0_#000]">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="mt-3 h-4 w-56" />
        <div className="mt-5 flex gap-6">
          <Skeleton className="h-12 w-40" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <Skeleton className="h-40 w-full rounded-[12px]" />
        <Skeleton className="h-40 w-full rounded-[12px]" />
      </div>
      <Skeleton className="h-32 w-full rounded-[12px]" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-36 w-full rounded-[12px]" />
        <Skeleton className="h-36 w-full rounded-[12px]" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */
export default function MihomoPage() {
  const navigate = useNavigate();
  const { status, loading: statusLoading, error: statusError, refetch } = useMihomoStatus();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [dashboardInfo, setDashboardInfo] = useState<DashboardInfo | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardInfo = async () => {
      try {
        const info = await mihomoApi.getDashboardInfo();
        setDashboardInfo(info);
        setDashboardError(null);
      } catch (error) {
        setDashboardError(error instanceof Error ? error.message : "Failed to fetch dashboard info");
      }
    };
    fetchDashboardInfo();
  }, []);

  const buildDashboardUrl = (dashboard: string): string => {
    if (!dashboardInfo) return "#";
    const hostname = window.location.hostname;
    const port = dashboardInfo.port;
    const secret = dashboardInfo.secret;
    const protocol = window.location.protocol;
    return `${protocol}//${hostname}:${port}/ui/${dashboard}/?hostname=${hostname}&port=${port}&secret=${secret}`;
  };

  const handleAction = async (action: string, fn: () => Promise<void>) => {
    setActionLoading(action);
    try {
      await fn();
      toast.success(`Mihomo ${action} successful`);
      setTimeout(refetch, 1000);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to ${action} mihomo`);
    } finally {
      setActionLoading(null);
    }
  };

  if (statusLoading) {
    return <MihomoSkeleton />;
  }

  const isRunning = status.running;
  const isDegraded = isRunning && Boolean(statusError);
  const isOffline = !isRunning;

  /* Posture */
  const posture = isOffline ? "Stopped" : isDegraded ? "Degraded" : "Running";
  const postureTone = isOffline ? "text-danger" : isDegraded ? "text-warning" : "text-primary";
  const postureDot = isOffline ? "bg-danger" : isDegraded ? "bg-warning animate-pulse" : "bg-primary";
  const postureBadgeBg = isOffline
    ? "border-danger bg-danger/10 text-danger"
    : isDegraded
      ? "border-warning bg-warning/10 text-warning"
      : "border-primary bg-primary/10 text-primary";

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-[16px] border-2 border-black bg-surface p-5 shadow-[8px_8px_0_#000]">
        <div className="absolute right-[-60px] top-[-80px] h-44 w-44 rounded-full border-2 border-black bg-primary/10" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl uppercase tracking-wide text-text">Mihomo</h1>
              <FreshnessPill
                loading={false}
                error={statusError}
                lastUpdatedAt={null}
                stale={Boolean(statusError)}
              />
            </div>
            <p className="mt-2 font-mono text-xs uppercase tracking-wider text-text-muted">
              Core process management and operational control
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
              {status.uptime != null && status.uptime > 0 && (
                <div className="pb-1">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Uptime</p>
                  <p className="font-heading text-lg text-text">{formatDuration(status.uptime)}</p>
                </div>
              )}
              <div className="pb-1">
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Status</p>
                <span className={`inline-flex items-center gap-1.5 rounded-[6px] border-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${postureBadgeBg}`}>
                  <Power className="h-3 w-3" />
                  {isRunning ? "Process active" : "Process inactive"}
                </span>
              </div>
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
          title="Status unreachable"
          message={statusError}
          action={<RetroBtn size="sm" variant="ghost" onClick={() => refetch()}>Retry</RetroBtn>}
        />
      )}

      {/* ── Main grid ── */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        {/* Left: Controls */}
        <div className="space-y-6">
          <Card title="Process Control" icon={<Power className="h-4 w-4" />}>
            {/* Safety warning when running */}
            {isRunning && (
              <div className="mb-4 rounded-[8px] border-2 border-primary/40 bg-primary/10 px-3 py-2">
                <div className="flex items-start gap-2">
                  <Shield className="mt-0.5 h-3.5 w-3.5 text-primary" />
                  <p className="font-mono text-xs text-text-muted">
                    Mihomo is active. Stopping interrupts all proxy traffic and active connections.
                  </p>
                </div>
              </div>
            )}

            {/* Warning when stopped */}
            {!isRunning && (
              <div className="mb-4 rounded-[8px] border-2 border-danger/40 bg-danger/10 px-3 py-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-danger" />
                  <p className="font-mono text-xs text-danger">
                    Mihomo is stopped. All proxy traffic is currently offline.
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <RetroBtn
                variant="primary"
                size="md"
                disabled={actionLoading !== null || status.running}
                onClick={() => handleAction("start", () => mihomoApi.start())}
              >
                <Play className="mr-1.5 inline-block h-4 w-4" />
                {actionLoading === "start" ? "Starting..." : "Start"}
              </RetroBtn>
              <RetroBtn
                variant="danger"
                size="md"
                disabled={actionLoading !== null || !status.running}
                onClick={() => handleAction("stop", () => mihomoApi.stop())}
              >
                <Square className="mr-1.5 inline-block h-4 w-4" />
                {actionLoading === "stop" ? "Stopping..." : "Stop"}
              </RetroBtn>
              <RetroBtn
                variant="warning"
                size="md"
                disabled={actionLoading !== null || !status.running}
                onClick={() => handleAction("restart", () => mihomoApi.restart())}
              >
                <RefreshCcw className="mr-1.5 inline-block h-4 w-4" />
                {actionLoading === "restart" ? "Restarting..." : "Restart"}
              </RetroBtn>
            </div>
          </Card>

          {/* Config editor */}
          <Card title="Configuration" icon={<FileCode className="h-4 w-4" />}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-mono text-xs leading-relaxed text-text-muted">
                  Edit YAML config files, proxy providers, and rule providers with syntax highlighting.
                </p>
              </div>
              <RetroBtn variant="ghost" size="sm" onClick={() => navigate("/mihomo/config")}>
                <FileCode className="mr-1.5 inline-block h-3.5 w-3.5" />
                Open Editor
                <ArrowUpRight className="ml-1 inline-block h-3 w-3 text-text-muted" />
              </RetroBtn>
            </div>
          </Card>
        </div>

        {/* Right: Context */}
        <div className="space-y-6">
          {/* Runtime terminal */}
          <Card title="Runtime Context" icon={<TerminalSquare className="h-4 w-4" />}>
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
                {status.memory != null && (
                  <div className="text-text-muted">
                    Memory: {formatBytes(status.memory)}
                  </div>
                )}
                {status.cpu != null && (
                  <div className="text-text-muted">
                    CPU: {(status.cpu * 100).toFixed(1)}%
                  </div>
                )}
                {dashboardInfo && (
                  <div className="border-t border-[#1a1a1a] pt-2 text-text-muted">
                    Dashboard port: {dashboardInfo.port}
                  </div>
                )}
                {statusError && (
                  <div className="border-t border-[#1a1a1a] pt-2 text-danger">
                    {statusError}
                  </div>
                )}
                <div className="terminal-cursor mt-2 inline-block text-primary" />
              </div>
            </Terminal>
          </Card>

          {/* System info metadata */}
          <Card title="System Metadata" icon={<Info className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[8px] border border-black/70 bg-black/15 px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">State</p>
                <p className={`mt-1 font-heading text-sm uppercase tracking-wide ${postureTone}`}>{posture}</p>
              </div>
              <div className="rounded-[8px] border border-black/70 bg-black/15 px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Version</p>
                <p className="mt-1 font-heading text-sm text-text">{status.version || "—"}</p>
              </div>
              <div className="rounded-[8px] border border-black/70 bg-black/15 px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Uptime</p>
                <p className="mt-1 font-heading text-sm text-text">{status.uptime != null && status.uptime > 0 ? formatDuration(status.uptime) : "—"}</p>
              </div>
              <div className="rounded-[8px] border border-black/70 bg-black/15 px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">CPU</p>
                <p className="mt-1 font-heading text-sm text-text">{status.cpu != null ? `${(status.cpu * 100).toFixed(1)}%` : "—"}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Dashboard Links ── */}
      <Card title="External Dashboards" icon={<ExternalLink className="h-4 w-4" />}>
        {dashboardError && (
          <DataState
            tone="warning"
            icon={<AlertTriangle className="h-4 w-4" />}
            title="Dashboard info unavailable"
            message={dashboardError}
            className="mb-4"
          />
        )}
        {!isRunning ? (
          <DataState
            tone="neutral"
            icon={<ExternalLink className="h-4 w-4" />}
            title="Mihomo is not running"
            message="Start Mihomo to access external dashboards."
            className="mb-0"
          />
        ) : dashboardInfo && dashboardInfo.dashboards.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {dashboardInfo.dashboards.map((dashboard) => {
              const url = buildDashboardUrl(dashboard);
              return (
                <button
                  key={dashboard}
                  type="button"
                  onClick={() => window.open(url, "_blank")}
                  className="group flex items-center gap-3 rounded-[12px] border-2 border-black bg-black/10 p-4 text-left shadow-[4px_4px_0_#000] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#000] hover:bg-primary/10"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border-2 border-black bg-surface group-hover:bg-primary/15">
                    <ExternalLink className="h-4 w-4 text-text-muted group-hover:text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-heading text-sm uppercase tracking-wide text-text group-hover:text-primary">
                      {dashboard.charAt(0).toUpperCase() + dashboard.slice(1)}
                      <ArrowUpRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[10px] text-text-muted">
                      Port {dashboardInfo.port}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : !dashboardError ? (
          <DataState
            tone="neutral"
            icon={<ExternalLink className="h-4 w-4" />}
            title="No dashboards configured"
            message="No external Mihomo dashboard UIs were detected."
            className="mb-0"
          />
        ) : null}
      </Card>
    </div>
  );
}

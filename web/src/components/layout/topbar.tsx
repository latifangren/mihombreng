import { Activity, CircleAlert, Clock, Loader2, Menu, RefreshCcw } from "lucide-react";
import type { MihomoStatus } from "@/types";
import { formatDuration } from "@/utils/format";
import { TunnelIndicator } from "@/components/status/tunnel-indicator";

export type TunnelMode = "tun" | "tproxy" | "redirect" | "off";

interface TopbarProps {
  status: MihomoStatus;
  tunnelMode?: TunnelMode;
  version?: string;
  loading?: boolean;
  error?: string | null;
  lastUpdatedAt?: Date | null;
  onRetry?: () => void;
  onMenuToggle?: () => void;
}

function freshLabel(lastUpdatedAt?: Date | null) {
  if (!lastUpdatedAt) return "Waiting for first read";
  return `Fresh ${lastUpdatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
}

export function Topbar({ status, tunnelMode = "off", version, loading = false, error, lastUpdatedAt, onRetry, onMenuToggle }: TopbarProps) {
  const isRunning = status.running;
  const stateLabel = loading ? "Syncing" : error ? "Status stale" : isRunning ? "Running" : "Stopped";
  const dotClass = loading ? "bg-warning animate-pulse" : error ? "bg-danger" : isRunning ? "bg-primary" : "bg-danger";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b-2 border-black bg-surface px-4 sm:px-6">
      {/* Left */}
      <div className="flex min-w-0 items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          type="button"
          onClick={onMenuToggle}
          className="rounded-lg border-2 border-black p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 rounded-full border-2 border-black bg-background px-3 py-1">
          <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
          <span className="font-mono text-xs text-text">{stateLabel}</span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-warning" />}
        </div>
        {version && (
          <div className="hidden items-center gap-1 text-text-muted sm:flex">
            <Activity className="h-3 w-3" />
            <span className="font-mono text-[11px]">{version}</span>
          </div>
        )}
        <div className="hidden min-w-0 items-center gap-1 text-text-muted md:flex">
          {error ? <CircleAlert className="h-3 w-3 shrink-0 text-danger" /> : <Clock className="h-3 w-3 shrink-0" />}
          <span className="truncate font-mono text-[11px]">
            {error ? `Stale: ${error}` : freshLabel(lastUpdatedAt)}
          </span>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {error && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="hidden items-center gap-1 rounded-lg border-2 border-black bg-danger/10 px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-danger transition-colors hover:bg-danger/20 sm:flex"
          >
            <RefreshCcw className="h-3 w-3" />
            Retry
          </button>
        )}
        {isRunning && status.uptime && !error && (
          <div className="hidden items-center gap-1 text-text-muted sm:flex">
            <Clock className="h-3 w-3" />
            <span className="font-mono text-[11px]">
              {formatDuration(status.uptime)}
            </span>
          </div>
        )}
        <TunnelIndicator mode={tunnelMode} running={isRunning && !error} />
      </div>
    </header>
  );
}

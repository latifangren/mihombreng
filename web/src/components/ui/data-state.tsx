import { cn } from "@/utils/cn";
import type { ReactNode } from "react";

interface DataStateProps {
  tone?: "neutral" | "danger" | "warning" | "success";
  icon?: ReactNode;
  title: string;
  message?: string;
  action?: ReactNode;
  className?: string;
}

const toneClass = {
  neutral: "border-black bg-black/10 text-text",
  danger: "border-danger bg-danger/10 text-danger",
  warning: "border-warning bg-warning/10 text-warning",
  success: "border-primary bg-primary/10 text-primary",
};

export function DataState({ tone = "neutral", icon, title, message, action, className }: DataStateProps) {
  return (
    <div
      className={cn(
        "rounded-[12px] border-2 p-5 shadow-[6px_6px_0_#000]",
        toneClass[tone],
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon && <span className="shrink-0">{icon}</span>}
            <p className="font-heading text-sm uppercase tracking-wider">{title}</p>
          </div>
          {message && <p className="mt-2 max-w-2xl font-mono text-xs leading-relaxed text-text-muted">{message}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

interface FreshnessPillProps {
  loading?: boolean;
  error?: string | null;
  lastUpdatedAt?: Date | string | null;
  stale?: boolean;
  className?: string;
}

export function FreshnessPill({ loading = false, error, lastUpdatedAt, stale = false, className }: FreshnessPillProps) {
  const parsedDate = lastUpdatedAt ? new Date(lastUpdatedAt) : null;
  const label = loading
    ? "Syncing"
    : error || stale
      ? "Stale data"
      : parsedDate
        ? `Fresh ${parsedDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
        : "Not yet synced";
  const dotClass = loading
    ? "bg-warning animate-pulse"
    : error || stale
      ? "bg-danger"
      : parsedDate
        ? "bg-primary"
        : "bg-text-muted";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border-2 border-black bg-background px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-text-muted",
        className
      )}
      title={error || undefined}
    >
      <span className={cn("h-2 w-2 rounded-full", dotClass)} />
      {label}
    </span>
  );
}

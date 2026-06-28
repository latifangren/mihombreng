import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Shield,
  FileText,
  FolderOpen,
  FolderGit2,
  RadioTower,
  ScrollText,
  Wrench,
  Archive,
  Activity,
  Network,
  Settings,
  CircleAlert,
  Clock,
  Loader2,
} from "lucide-react";
import type { MihomoStatus } from "@/types";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/mihomo", label: "Mihomo", icon: Shield },
  { to: "/mihomo/config", label: "Config", icon: FileText },
  { to: "/manager", label: "Manager", icon: FolderOpen },
  { to: "/providers", label: "Providers", icon: FolderGit2 },
  { to: "/profiles", label: "Profiles", icon: RadioTower },
  { to: "/traffic", label: "Traffic", icon: Activity },
  { to: "/connections", label: "Connections", icon: Network },
  { to: "/logs", label: "Logs", icon: ScrollText },
  { to: "/tools", label: "Tools", icon: Wrench },
  { to: "/backup", label: "Backup", icon: Archive },
  { to: "/diagnostics", label: "Diagnostics", icon: Activity },
  { to: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  status?: MihomoStatus;
  loading?: boolean;
  error?: string | null;
  lastUpdatedAt?: Date | null;
  onNavigate?: () => void;
}

function timeLabel(value?: Date | null) {
  if (!value) return "Never synced";
  return value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function Sidebar({ status, loading = false, error, lastUpdatedAt, onNavigate }: SidebarProps) {
  const isRunning = Boolean(status?.running);
  const healthLabel = loading ? "Syncing" : error ? "Backend stale" : isRunning ? "Core online" : "Core stopped";
  const dotClass = loading
    ? "bg-warning animate-pulse"
    : error
      ? "bg-danger"
      : isRunning
        ? "bg-primary"
        : "bg-text-muted";

  return (
    <aside className="flex h-full w-60 flex-col border-r-2 border-black bg-surface">
      {/* Logo */}
      <div className="border-b-2 border-black px-5 py-4">
        <h1 className="font-heading text-lg font-black uppercase tracking-wider text-primary">
          Mihombreng
        </h1>
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
          XRay Control Panel
        </span>
      </div>

      {/* Health block */}
      <div className="border-b-2 border-black bg-black/10 px-4 py-3">
        <div className="rounded-[10px] border-2 border-black bg-background p-3 shadow-[4px_4px_0_#000]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
              <span className="font-heading text-[11px] uppercase tracking-wider text-text">
                {healthLabel}
              </span>
            </div>
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-warning" />
            ) : error ? (
              <CircleAlert className="h-3.5 w-3.5 text-danger" />
            ) : (
              <Clock className="h-3.5 w-3.5 text-text-muted" />
            )}
          </div>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-text-muted">
            {error ? "Showing last known state" : `Fresh @ ${timeLabel(lastUpdatedAt)}`}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg border-2 px-3 py-2 text-sm transition-all ${
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-transparent text-text-muted hover:border-black hover:bg-surface-hover hover:text-text"
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="font-medium">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t-2 border-black px-5 py-3">
        <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          {status?.version ? `Core ${status.version}` : "Version pending"}
        </span>
      </div>
    </aside>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import type { TunnelMode } from "@/components/layout/topbar";
import { useMihomoStatus } from "@/hooks/use-mihomo-status";
import { configApi } from "@/services/api";
import type { AppConfig, MihomoStatus } from "@/types";

function deriveTunnelMode(config: AppConfig | null): TunnelMode {
  const tcp = (config?.mihomo?.Routing?.TCP || "").toLowerCase();
  const udp = (config?.mihomo?.Routing?.UDP || "").toLowerCase();

  if (tcp === "tun" || udp === "tun") return "tun";
  if (tcp === "tproxy" || udp === "tproxy") return "tproxy";
  if (tcp === "redirect") return "redirect";
  if (tcp === "disable" && udp === "disable") return "off";
  return "off";
}

export function Shell() {
  const { status, loading, error, refetch } = useMihomoStatus();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lastGoodStatus, setLastGoodStatus] = useState<MihomoStatus | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    void configApi.getConfig().then(setAppConfig).catch(() => null);
  }, []);

  useEffect(() => {
    if (!loading && !error) {
      setLastGoodStatus(status);
      setLastUpdatedAt(new Date());
    }
  }, [error, loading, status]);

  const statusForDisplay = useMemo(
    () => (error && lastGoodStatus ? lastGoodStatus : status),
    [error, lastGoodStatus, status]
  );
  const tunnelMode = useMemo(() => deriveTunnelMode(appConfig), [appConfig]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixed on mobile, static on desktop */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40 transition-transform duration-200
          lg:static lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <Sidebar
          status={statusForDisplay}
          loading={loading}
          error={error}
          lastUpdatedAt={lastUpdatedAt}
          onNavigate={() => setSidebarOpen(false)}
        />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          status={statusForDisplay}
          tunnelMode={tunnelMode}
          version={statusForDisplay.version}
          loading={loading}
          error={error}
          lastUpdatedAt={lastUpdatedAt}
          onRetry={() => void refetch()}
          onMenuToggle={() => setSidebarOpen((o) => !o)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

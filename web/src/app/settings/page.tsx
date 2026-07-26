"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DataState, FreshnessPill } from "@/components/ui/data-state";
import { RetroBtn } from "@/components/ui/retro-btn";
import { UpdateWarningBanner } from "@/components/ui/update-warning-banner";
import { configApi, mihomoApi } from "@/services/api";
import {
  AlertTriangle,
  AlertOctagon,
  CircleDot,
  FileText,
  Globe,
  Info,
  RefreshCcw,
  Save,
  Shield,
  Server,
  Database,
  Lock,
} from "lucide-react";
import type {
  AppConfig,
  AppUpdateCheck,
  AutoRestartSettings,
  MihomoConfig,
  RoutingConfig,
  ServerConfig,
  APIConfig,
  LoggingConfig,
  BackupConfig,
} from "@/types";
import toast from "react-hot-toast";

const defaultAutoRestartOpts: AutoRestartSettings = {
  on_crash: false,
  on_config_change: false,
  on_network_change: false,
  on_routing_failure: false,
  schedule_enabled: false,
  schedule_interval: "daily",
  schedule_time: "04:00",
};

const defaultServerConfig: ServerConfig = {
  Port: "7777",
  Host: "0.0.0.0",
  Mode: "release",
};

const defaultAPIConfig: APIConfig = {
  RateLimit: 100,
  Timeout: 30,
  EnableSwagger: false,
  AuthToken: "",
};

const defaultLoggingConfig: LoggingConfig = {
  level: "info",
  file: "/var/log/mihombreng.log",
  max_size: 100,
  max_backups: 3,
  max_age: 28,
};

const defaultBackupConfig: BackupConfig = {
  auto_backup_enabled: true,
  max_backups: 10,
  max_age_days: 30,
  backup_dir: "/etc/mihombreng/backups",
};

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                  */
/* ------------------------------------------------------------------ */
function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-[16px] border-2 border-black bg-surface p-5 shadow-[8px_8px_0_#000]">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="mt-3 h-4 w-56" />
        <div className="mt-5 flex gap-6">
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-[12px]" />
        <Skeleton className="h-64 w-full rounded-[12px]" />
        <Skeleton className="h-64 w-full rounded-[12px]" />
        <Skeleton className="h-64 w-full rounded-[12px]" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */
export default function SettingsPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [coreVersion, setCoreVersion] = useState("");
  const [availableConfigs, setAvailableConfigs] = useState<string[]>([]);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [updateCheck, setUpdateCheck] = useState<AppUpdateCheck | null>(null);
  const [dirty, setDirty] = useState(false);
  const savedConfigRef = useRef<string>("");

  const [isExtendedOpen, setIsExtendedOpen] = useState(false);
  const [rawJson, setRawJson] = useState("");
  const [rawJsonError, setRawJsonError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [cfg, version, configs] = await Promise.all([
        configApi.getConfig(),
        mihomoApi.getCoreVersion().catch(() => ""),
        mihomoApi.getConfigs().catch(() => []),
      ]);
      const rawOpts = cfg.mihomo?.AutoRestartOpts || (cfg.mihomo as unknown as Record<string, unknown>)?.auto_restart_opts;
      const normalizedOpts: AutoRestartSettings = {
        ...defaultAutoRestartOpts,
        ...(typeof rawOpts === "object" && rawOpts !== null ? rawOpts : {}),
      };
      const normalizedServer: ServerConfig = {
        ...defaultServerConfig,
        ...(cfg.server || {}),
      };
      const normalizedAPI: APIConfig = {
        ...defaultAPIConfig,
        ...(cfg.api || {}),
      };
      const normalizedLogging: LoggingConfig = {
        ...defaultLoggingConfig,
        ...(cfg.logging || {}),
      };
      const normalizedBackup: BackupConfig = {
        ...defaultBackupConfig,
        ...(cfg.backup || {}),
      };
      const normalizedConfig: AppConfig = {
        ...cfg,
        server: normalizedServer,
        mihomo: {
          ...cfg.mihomo,
          AutoStart: cfg.mihomo?.AutoStart ?? true,
          AutoRestartOpts: normalizedOpts,
          Routing: {
            ...cfg.mihomo?.Routing,
            TunDevice: cfg.mihomo?.Routing?.TunDevice || cfg.mihomo?.TunDevice || "Meta",
          },
        },
        logging: normalizedLogging,
        api: normalizedAPI,
        backup: normalizedBackup,
      };
      setConfig(normalizedConfig);
      setRawJson(JSON.stringify(normalizedConfig, null, 2));
      setCoreVersion(version);
      setAvailableConfigs(configs);
      setDirty(false);
      setLastLoadedAt(new Date());
      savedConfigRef.current = JSON.stringify(normalizedConfig);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load configuration");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    mihomoApi.checkUpdate().then(setUpdateCheck).catch(() => setUpdateCheck(null));
  }, []);

  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    if (!config) return;
    const task = setTimeout(async () => {
      setValidating(true);
      try {
        const res = await configApi.validateRouting(config.mihomo.Routing);
        setValidationIssues(res.issues || []);
      } catch (err) {
        console.error(err);
      } finally {
        setValidating(false);
      }
    }, 500);

    return () => clearTimeout(task);
  }, [config]);

  const handleServerChange = <K extends keyof ServerConfig>(field: K, value: ServerConfig[K]) => {
    if (!config) return;
    const next = { ...config, server: { ...config.server, [field]: value } };
    setConfig(next);
    setDirty(JSON.stringify(next) !== savedConfigRef.current);
  };

  const handleMihomoChange = <K extends keyof MihomoConfig>(field: K, value: MihomoConfig[K]) => {
    if (!config) return;
    const next = { ...config, mihomo: { ...config.mihomo, [field]: value } };
    setConfig(next);
    setDirty(JSON.stringify(next) !== savedConfigRef.current);
  };

  const handleAutoRestartOptsChange = <K extends keyof AutoRestartSettings>(
    field: K,
    value: AutoRestartSettings[K]
  ) => {
    if (!config) return;
    const currentOpts = config.mihomo.AutoRestartOpts || defaultAutoRestartOpts;
    const nextOpts: AutoRestartSettings = {
      ...currentOpts,
      [field]: value,
    };
    const next: AppConfig = {
      ...config,
      mihomo: {
        ...config.mihomo,
        AutoRestartOpts: nextOpts,
      },
    };
    setConfig(next);
    setDirty(JSON.stringify(next) !== savedConfigRef.current);
  };

  const handleRoutingChange = <K extends keyof RoutingConfig>(field: K, value: RoutingConfig[K]) => {
    if (!config) return;
    const next = {
      ...config,
      mihomo: {
        ...config.mihomo,
        Routing: { ...config.mihomo.Routing, [field]: value },
      },
    };
    setConfig(next);
    setDirty(JSON.stringify(next) !== savedConfigRef.current);
  };

  const handleLoggingChange = <K extends keyof LoggingConfig>(field: K, value: LoggingConfig[K]) => {
    if (!config) return;
    const next = { ...config, logging: { ...config.logging, [field]: value } };
    setConfig(next);
    setDirty(JSON.stringify(next) !== savedConfigRef.current);
  };

  const handleAPIChange = <K extends keyof APIConfig>(field: K, value: APIConfig[K]) => {
    if (!config) return;
    const next = { ...config, api: { ...config.api, [field]: value } };
    setConfig(next);
    setDirty(JSON.stringify(next) !== savedConfigRef.current);
  };

  const handleBackupChange = <K extends keyof BackupConfig>(field: K, value: BackupConfig[K]) => {
    if (!config) return;
    const currentBackup = config.backup || defaultBackupConfig;
    const next = { ...config, backup: { ...currentBackup, [field]: value } };
    setConfig(next);
    setDirty(JSON.stringify(next) !== savedConfigRef.current);
  };

  const handleBypassChange = (field: "BypassMACs" | "BypassIPs" | "BypassIP6s", val: string) => {
    const list = val.split("\n").map((x) => x.trim()).filter(Boolean);
    handleRoutingChange(field, list);
  };

  const handleRawSave = () => {
    try {
      const parsed = JSON.parse(rawJson);
      if (!parsed.mihomo || !parsed.logging || !parsed.server || !parsed.api) {
        throw new Error("Missing required root properties in configuration.");
      }
      const rawOpts = parsed.mihomo.AutoRestartOpts || parsed.mihomo.auto_restart_opts;
      const normalizedOpts: AutoRestartSettings = {
        ...defaultAutoRestartOpts,
        ...(typeof rawOpts === "object" && rawOpts !== null ? rawOpts : {}),
      };
      const next: AppConfig = {
        ...config!,
        ...parsed,
        mihomo: {
          ...parsed.mihomo,
          AutoRestartOpts: normalizedOpts,
        },
      };
      setConfig(next);
      setDirty(JSON.stringify(next) !== savedConfigRef.current);
      setRawJsonError(null);
      toast.success("Extended config updated in memory — save settings to persist to disk");
    } catch (err) {
      setRawJsonError(err instanceof Error ? err.message : "Invalid JSON format");
      toast.error("Invalid configuration format.");
    }
  };

  const handleSubmit = async () => {
    if (!config) return;
    if (validationIssues.length > 0) {
      toast.error("Cannot save configuration: Please resolve the routing validation issues first.");
      return;
    }
    setSaving(true);
    try {
      await configApi.updateConfig(config);
      savedConfigRef.current = JSON.stringify(config);
      setDirty(false);
      setLastLoadedAt(new Date());
      setRawJson(JSON.stringify(config, null, 2));
      toast.success("Configuration saved — restart Mihomo to apply");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  /* ── Loading ── */
  if (loading) {
    return <SettingsSkeleton />;
  }

  /* ── Error (total failure) ── */
  if (!config) {
    return (
      <div className="space-y-6">
        <div className="rounded-[16px] border-2 border-black bg-surface p-5 shadow-[8px_8px_0_#000]">
          <h1 className="font-heading text-2xl uppercase tracking-wide text-text">Settings</h1>
          <p className="mt-2 font-mono text-xs uppercase tracking-wider text-text-muted">
            Application configuration
          </p>
        </div>
        <DataState
          tone="danger"
          icon={<AlertTriangle className="h-4 w-4" />}
          title="Configuration unavailable"
          message={loadError || "Could not load application configuration. The backend may be unreachable."}
          action={<RetroBtn size="sm" variant="ghost" onClick={() => void fetchData()}>Retry</RetroBtn>}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <div className="relative overflow-hidden rounded-[16px] border-2 border-black bg-surface p-5 shadow-[8px_8px_0_#000]">
        <div className="absolute right-[-60px] top-[-80px] h-44 w-44 rounded-full border-2 border-black bg-primary/10" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl uppercase tracking-wide text-text">Settings</h1>
              <FreshnessPill
                loading={false}
                error={loadError}
                lastUpdatedAt={lastLoadedAt}
                stale={false}
              />
              {dirty && (
                <span className="inline-flex items-center gap-1.5 rounded-[6px] border-2 border-warning bg-warning/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-warning">
                  <AlertOctagon className="h-3 w-3" />
                  Unsaved changes
                </span>
              )}
            </div>
            <p className="mt-2 font-mono text-xs uppercase tracking-wider text-text-muted">
              Application configuration and Mihomo core settings
            </p>
          </div>
          <div className="flex items-center gap-3">
            <RetroBtn variant="ghost" size="sm" onClick={() => void fetchData()}>
              <RefreshCcw className="mr-1.5 inline-block h-3.5 w-3.5" />
              Reload
            </RetroBtn>
            <RetroBtn
              variant={dirty ? "primary" : "ghost"}
              size="sm"
              onClick={() => void handleSubmit()}
              disabled={saving || !dirty}
              loading={saving}
            >
              <Save className="mr-1.5 inline-block h-3.5 w-3.5" />
              {saving ? "Saving..." : "Save"}
            </RetroBtn>
          </div>
        </div>
      </div>

      <UpdateWarningBanner update={updateCheck} />

      {loadError && (
        <DataState
          tone="warning"
          title="Last load had errors"
          message={loadError}
          action={<RetroBtn size="sm" variant="ghost" onClick={() => void fetchData()}>Retry</RetroBtn>}
        />
      )}

      {/* App Info Read-Only Metadata */}
      <Card title="App Info" icon={<Info className="h-4 w-4" />} action={
        dirty ? (
          <span className="font-mono text-[10px] text-warning">modified</span>
        ) : undefined
      }>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-text-muted">
          Read-only application metadata
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <ConfigRow label="Version" value={config.version} />
          <ConfigRow label="Environment" value={config.environment} />
          <ConfigRow label="Core Version" value={coreVersion || "Unknown"} />
          <div className="rounded-[8px] border border-black/70 bg-black/15 px-4 py-2.5 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">API Docs</span>
            <a
              href="/docs/index.html"
              target="_blank"
              rel="noreferrer"
              className="font-mono text-sm text-primary hover:underline"
            >
              Swagger UI
            </a>
          </div>
        </div>
      </Card>

      {/* ── 5 Main Settings Cards ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card 1: Mihomo Core & Boot */}
        <Card title="Mihomo Core & Boot" icon={<CircleDot className="h-4 w-4" />}>
          <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Core executable paths, working directory, log outputs, auto-start, and auto-restart policies
          </p>
          <div className="space-y-3">
            <ConfigInput
              label="Core Path"
              value={config.mihomo.CorePath}
              onChange={(v) => handleMihomoChange("CorePath", v)}
            />
            <ConfigSelect
              label="Config Path"
              value={config.mihomo.ConfigPath}
              options={[
                `${config.mihomo.WorkingDir}/configs/config.yaml`,
                ...availableConfigs.map((n) => `${config.mihomo.WorkingDir}/configs/${n}`),
              ]}
              onChange={(v) => handleMihomoChange("ConfigPath", v)}
            />
            <ConfigInput
              label="Working Directory"
              value={config.mihomo.WorkingDir}
              onChange={(v) => handleMihomoChange("WorkingDir", v)}
            />
            <ConfigInput
              label="Log File"
              value={config.mihomo.LogFile}
              onChange={(v) => handleMihomoChange("LogFile", v)}
            />
            <ConfigCheckbox
              label="Auto Start"
              description="Automatically launch Mihomo core on system boot"
              checked={config.mihomo.AutoStart ?? true}
              onChange={(v) => handleMihomoChange("AutoStart", v)}
            />
            <ConfigCheckbox
              label="Auto Restart"
              description="Automatically restart core process if it exits unexpectedly"
              checked={config.mihomo.AutoRestart}
              onChange={(v) => handleMihomoChange("AutoRestart", v)}
            />

            {config.mihomo.AutoRestart && (
              <div className="ml-4 mt-2 space-y-2.5 border-l-2 border-primary/30 pl-4">
                <ConfigCheckbox
                  label="Restart on Core Crash"
                  checked={(config.mihomo.AutoRestartOpts || defaultAutoRestartOpts).on_crash}
                  onChange={(v) => handleAutoRestartOptsChange("on_crash", v)}
                />
                <ConfigCheckbox
                  label="Restart on Config Change"
                  checked={(config.mihomo.AutoRestartOpts || defaultAutoRestartOpts).on_config_change}
                  onChange={(v) => handleAutoRestartOptsChange("on_config_change", v)}
                />
                <ConfigCheckbox
                  label="Restart on Network Interface Change"
                  checked={(config.mihomo.AutoRestartOpts || defaultAutoRestartOpts).on_network_change}
                  onChange={(v) => handleAutoRestartOptsChange("on_network_change", v)}
                />
                <ConfigCheckbox
                  label="Restart on Routing Failure"
                  checked={(config.mihomo.AutoRestartOpts || defaultAutoRestartOpts).on_routing_failure}
                  onChange={(v) => handleAutoRestartOptsChange("on_routing_failure", v)}
                />
                <ConfigCheckbox
                  label="Scheduled Maintenance Restart"
                  checked={(config.mihomo.AutoRestartOpts || defaultAutoRestartOpts).schedule_enabled}
                  onChange={(v) => handleAutoRestartOptsChange("schedule_enabled", v)}
                />

                {(config.mihomo.AutoRestartOpts || defaultAutoRestartOpts).schedule_enabled && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
                    <ConfigSelect
                      label="Interval"
                      value={(config.mihomo.AutoRestartOpts || defaultAutoRestartOpts).schedule_interval}
                      options={["daily", "weekly"]}
                      onChange={(v) => handleAutoRestartOptsChange("schedule_interval", v)}
                    />
                    <ConfigInput
                      label="Time"
                      type="time"
                      value={(config.mihomo.AutoRestartOpts || defaultAutoRestartOpts).schedule_time}
                      placeholder="04:00"
                      onChange={(v) => handleAutoRestartOptsChange("schedule_time", v)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* Card 2: Network & TUN/TPROXY Routing */}
        <Card title="Network & TUN/TPROXY Routing" icon={<Globe className="h-4 w-4" />}>
          <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Interception modes, TUN interface device, and bypass MAC/IP rules
          </p>
          <div className="grid grid-cols-2 gap-3">
            <ConfigSelect
              label="TCP"
              value={config.mihomo.Routing.TCP}
              options={["tproxy", "tun", "redirect", "disable"]}
              onChange={(v) => handleRoutingChange("TCP", v)}
            />
            <ConfigSelect
              label="UDP"
              value={config.mihomo.Routing.UDP}
              options={["tproxy", "tun", "disable"]}
              onChange={(v) => handleRoutingChange("UDP", v)}
            />
          </div>

          <div className="mt-3 space-y-3">
            <ConfigInput
              label="TUN Device"
              value={config.mihomo.Routing.TunDevice || "Meta"}
              placeholder="Meta"
              onChange={(v) => handleRoutingChange("TunDevice", v)}
            />
            <ConfigTextArea
              label="Bypass MAC Addresses"
              placeholder="00:11:22:33:44:55 (one per line)"
              value={(config.mihomo.Routing.BypassMACs || []).join("\n")}
              onChange={(v) => handleBypassChange("BypassMACs", v)}
            />
            <ConfigTextArea
              label="Bypass IPv4 Address / CIDR"
              placeholder="192.168.1.100 (one per line)"
              value={(config.mihomo.Routing.BypassIPs || []).join("\n")}
              onChange={(v) => handleBypassChange("BypassIPs", v)}
            />
            <ConfigTextArea
              label="Bypass IPv6 Address / CIDR"
              placeholder="fe80::100 (one per line)"
              value={(config.mihomo.Routing.BypassIP6s || []).join("\n")}
              onChange={(v) => handleBypassChange("BypassIP6s", v)}
            />
          </div>

          {validating && (
            <div className="mt-3 font-mono text-[9px] text-text-muted animate-pulse">
              Validating routing configuration...
            </div>
          )}

          {validationIssues.length > 0 && (
            <div className="mt-3 rounded-[8px] border-2 border-danger bg-danger/10 p-3">
              <span className="font-heading text-xs uppercase tracking-wide text-danger flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Routing Validation Issues
              </span>
              <ul className="mt-1.5 list-disc list-inside font-mono text-[10px] text-danger space-y-1">
                {validationIssues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* Card 3: Web Server & Security API */}
        <Card title="Web Server & Security API" icon={<Server className="h-4 w-4" />}>
          <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            HTTP web server host/port, execution mode, API rate limits, timeouts, and authentication tokens
          </p>
          <div className="space-y-3">
            <ConfigInput
              label="Server Port"
              value={config.server.Port}
              onChange={(v) => handleServerChange("Port", v)}
            />
            <ConfigInput
              label="Server Host"
              value={config.server.Host}
              onChange={(v) => handleServerChange("Host", v)}
            />
            <ConfigSelect
              label="Server Mode"
              value={config.server.Mode}
              options={["release", "debug", "test"]}
              onChange={(v) => handleServerChange("Mode", v)}
            />
            <ConfigInput
              label="API Auth Token"
              type="password"
              value={config.api.AuthToken || ""}
              placeholder="Leave empty for no token"
              onChange={(v) => handleAPIChange("AuthToken", v)}
            />
            <ConfigInput
              label="Rate Limit (req/min)"
              type="number"
              value={String(config.api.RateLimit ?? 100)}
              onChange={(v) => handleAPIChange("RateLimit", Number(v) || 100)}
            />
            <ConfigInput
              label="Timeout (sec)"
              type="number"
              value={String(config.api.Timeout ?? 30)}
              onChange={(v) => handleAPIChange("Timeout", Number(v) || 30)}
            />
            <ConfigCheckbox
              label="Enable Swagger UI"
              description="Expose interactive OpenAPI documentation at /docs/index.html"
              checked={config.api.EnableSwagger}
              onChange={(v) => handleAPIChange("EnableSwagger", v)}
            />
          </div>
        </Card>

        {/* Card 4: Logging & Retention Policy */}
        <Card title="Logging & Retention Policy" icon={<FileText className="h-4 w-4" />}>
          <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Logging verbosity, log file location, and automatic log file rotation thresholds
          </p>
          <div className="space-y-3">
            <ConfigSelect
              label="Log Level"
              value={config.logging.level}
              options={["debug", "info", "warn", "error"]}
              onChange={(v) => handleLoggingChange("level", v)}
            />
            <ConfigInput
              label="Log File Path"
              value={config.logging.file || "/var/log/mihombreng.log"}
              onChange={(v) => handleLoggingChange("file", v)}
            />
            <ConfigInput
              label="Max Size (MB)"
              type="number"
              value={String(config.logging.max_size ?? 100)}
              onChange={(v) => handleLoggingChange("max_size", Number(v) || 100)}
            />
            <ConfigInput
              label="Max Backups"
              type="number"
              value={String(config.logging.max_backups ?? 3)}
              onChange={(v) => handleLoggingChange("max_backups", Number(v) || 3)}
            />
            <ConfigInput
              label="Max Age (days)"
              type="number"
              value={String(config.logging.max_age ?? 28)}
              onChange={(v) => handleLoggingChange("max_age", Number(v) || 28)}
            />
          </div>
        </Card>

        {/* Card 5: Automatic Backup Policy */}
        <Card title="Automatic Backup Policy" icon={<Database className="h-4 w-4" />}>
          <p className="mb-4 font-mono text-[10px] uppercase tracking-widest text-text-muted">
            Configuration backup schedules, retention history depth, and storage paths
          </p>
          <div className="space-y-3">
            <ConfigCheckbox
              label="Auto Backup Enabled"
              description="Automatically create configuration backups before updates and core actions"
              checked={config.backup?.auto_backup_enabled ?? true}
              onChange={(v) => handleBackupChange("auto_backup_enabled", v)}
            />
            <ConfigInput
              label="Backup Directory"
              value={config.backup?.backup_dir || "/etc/mihombreng/backups"}
              onChange={(v) => handleBackupChange("backup_dir", v)}
            />
            <ConfigInput
              label="Max Backups"
              type="number"
              value={String(config.backup?.max_backups ?? 10)}
              onChange={(v) => handleBackupChange("max_backups", Number(v) || 10)}
            />
            <ConfigInput
              label="Retention Days"
              type="number"
              value={String(config.backup?.max_age_days ?? 30)}
              onChange={(v) => handleBackupChange("max_age_days", Number(v) || 30)}
            />
          </div>
        </Card>
      </div>

      {/* Save summary card */}
      {dirty && (
        <div className="rounded-[12px] border-2 border-warning bg-warning/10 p-4 shadow-[6px_6px_0_#000]">
          <div className="flex items-start gap-3">
            <AlertOctagon className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
            <div>
              <p className="font-heading text-xs font-semibold uppercase tracking-wider text-warning">
                Unsaved configuration changes
              </p>
              <p className="mt-1 font-mono text-[11px] leading-relaxed text-text-muted">
                You have unsaved modifications. Click <strong>Save</strong> to persist changes.
                Mihomo will need to be restarted for core and routing changes to take effect.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Extended Settings (Danger Zone) ── */}
      <div className="mt-6">
        <Card
          title="Extended Settings (Raw Config)"
          icon={<Lock className="h-4 w-4 text-warning" />}
          action={
            <RetroBtn
              size="sm"
              variant="ghost"
              onClick={() => setIsExtendedOpen(!isExtendedOpen)}
            >
              {isExtendedOpen ? "Hide" : "Show"}
            </RetroBtn>
          }
        >
          {isExtendedOpen ? (
            <div className="space-y-4">
              <div className="rounded-[8px] border-2 border-warning bg-warning/5 p-3.5 flex items-start gap-2.5">
                <AlertOctagon className="h-5 w-5 text-warning flex-shrink-0" />
                <div className="font-mono text-[11px] leading-relaxed text-text-muted">
                  <strong className="text-warning uppercase font-semibold">Warning: Danger Zone.</strong> Changing raw config keys directly bypasses normal validation checks and can break the Mihomo process lifecycle. Make sure any edited keys are correctly formatted. Click <strong>Apply Raw Config</strong> below to stage changes in memory.
                </div>
              </div>
              <textarea
                value={rawJson}
                onChange={(e) => setRawJson(e.target.value)}
                rows={14}
                className="w-full rounded border border-border bg-surface p-3 font-mono text-xs text-text outline-none focus:border-warning"
              />
              {rawJsonError && (
                <p className="font-mono text-[10px] text-danger">Error: {rawJsonError}</p>
              )}
              <div className="flex justify-end">
                <RetroBtn size="sm" variant="warning" onClick={handleRawSave}>
                  Apply Raw Config
                </RetroBtn>
              </div>
            </div>
          ) : (
            <p className="font-mono text-[10px] text-text-muted">
              Advanced raw configuration parameters editor. Click Show to unfold.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Form controls                                                     */
/* ------------------------------------------------------------------ */
function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-black/70 bg-black/15 px-4 py-2.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{label}</span>
      <p className="mt-0.5 font-mono text-sm text-text">{value}</p>
    </div>
  );
}

function ConfigInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[8px] border border-black/70 bg-black/15 px-4 py-2.5">
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-64 rounded border border-border bg-surface px-3 py-1.5 font-mono text-sm text-text outline-none focus:border-primary"
      />
    </div>
  );
}

function ConfigSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[8px] border border-black/70 bg-black/15 px-4 py-2.5">
      <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-64 rounded border border-border bg-surface px-3 py-1.5 font-mono text-sm text-text outline-none focus:border-primary"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function ConfigCheckbox({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[8px] border border-black/70 bg-black/15 px-4 py-2.5">
      <div className="min-w-0">
        <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{label}</span>
        {description && (
          <p className="mt-0.5 font-mono text-[10px] text-text-muted">{description}</p>
        )}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 accent-primary"
      />
    </div>
  );
}

function ConfigTextArea({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[8px] border border-black/70 bg-black/15 px-4 py-2.5">
      <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full rounded border border-border bg-surface px-3 py-1.5 font-mono text-sm text-text outline-none focus:border-primary resize-y"
      />
    </div>
  );
}

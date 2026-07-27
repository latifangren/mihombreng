import type { ApiResponse, MihomoStatus, AppConfig, AppUpdateCheck, DashboardInfo, ParseResponse, DnsLookupResponse, BackupEntry, BackupStatus, DiagnosticsResponse, ConfigValidationResult, ConfigAutoFixResult, SubscriptionProfile, SubscriptionProfileInput, TrafficMetrics, ConnectionsListResponse, RemoteBackupTarget, RemoteSyncStatus, UnlockTestTarget, UnlockTestResult, ServerConfig, MihomoConfig, RoutingConfig, APIConfig, LoggingConfig, BackupConfig, AutoRestartSettings } from "@/types";

const API = "";

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export function normalizeAppConfig(raw: unknown): AppConfig {
  const cfg = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;

  const rawServer = ((typeof cfg.server === "object" && cfg.server !== null ? cfg.server : cfg.Server) || {}) as Record<string, unknown>;
  const server: ServerConfig = {
    Port: String(rawServer.Port ?? rawServer.port ?? "8080"),
    Host: String(rawServer.Host ?? rawServer.host ?? "0.0.0.0"),
    Mode: String(rawServer.Mode ?? rawServer.mode ?? "standalone"),
  };

  const rawMihomo = ((typeof cfg.mihomo === "object" && cfg.mihomo !== null ? cfg.mihomo : cfg.Mihomo) || {}) as Record<string, unknown>;
  const rawRouting = ((typeof rawMihomo.Routing === "object" && rawMihomo.Routing !== null ? rawMihomo.Routing : rawMihomo.routing) || {}) as Record<string, unknown>;
  const rawOpts = ((typeof rawMihomo.AutoRestartOpts === "object" && rawMihomo.AutoRestartOpts !== null ? rawMihomo.AutoRestartOpts : rawMihomo.auto_restart_opts) || {}) as Record<string, unknown>;

  const autoRestartOpts: AutoRestartSettings = {
    on_crash: Boolean(rawOpts.on_crash ?? rawOpts.OnCrash ?? false),
    on_config_change: Boolean(rawOpts.on_config_change ?? rawOpts.OnConfigChange ?? false),
    on_network_change: Boolean(rawOpts.on_network_change ?? rawOpts.OnNetworkChange ?? false),
    on_routing_failure: Boolean(rawOpts.on_routing_failure ?? rawOpts.OnRoutingFailure ?? false),
    schedule_enabled: Boolean(rawOpts.schedule_enabled ?? rawOpts.ScheduleEnabled ?? false),
    schedule_interval: String(rawOpts.schedule_interval ?? rawOpts.ScheduleInterval ?? "daily"),
    schedule_time: String(rawOpts.schedule_time ?? rawOpts.ScheduleTime ?? "04:00"),
  };

  const routing: RoutingConfig = {
    TCP: String(rawRouting.TCP ?? rawRouting.tcp ?? "tproxy"),
    UDP: String(rawRouting.UDP ?? rawRouting.udp ?? "tproxy"),
    TunDevice: String(rawRouting.TunDevice ?? rawRouting.tun_device ?? rawMihomo.TunDevice ?? rawMihomo.tun_device ?? "Meta"),
    BypassMACs: Array.isArray(rawRouting.BypassMACs ?? rawRouting.bypass_macs) ? ((rawRouting.BypassMACs ?? rawRouting.bypass_macs) as string[]) : [],
    BypassIPs: Array.isArray(rawRouting.BypassIPs ?? rawRouting.bypass_ips) ? ((rawRouting.BypassIPs ?? rawRouting.bypass_ips) as string[]) : [],
    BypassIP6s: Array.isArray(rawRouting.BypassIP6s ?? rawRouting.bypass_ip6s) ? ((rawRouting.BypassIP6s ?? rawRouting.bypass_ip6s) as string[]) : [],
  };

  const mihomo: MihomoConfig = {
    CorePath: String(rawMihomo.CorePath ?? rawMihomo.core_path ?? "/usr/bin/mihomo"),
    ConfigPath: String(rawMihomo.ConfigPath ?? rawMihomo.config_path ?? "/etc/mihomo/config.yaml"),
    WorkingDir: String(rawMihomo.WorkingDir ?? rawMihomo.working_dir ?? "/etc/mihomo"),
    AutoRestart: Boolean(rawMihomo.AutoRestart ?? rawMihomo.auto_restart ?? true),
    auto_restart_opts: autoRestartOpts,
    AutoRestartOpts: autoRestartOpts,
    AutoStart: Boolean(rawMihomo.AutoStart ?? rawMihomo.auto_start ?? true),
    LogFile: String(rawMihomo.LogFile ?? rawMihomo.log_file ?? "/var/log/mihomo.log"),
    APIURL: String(rawMihomo.APIURL ?? rawMihomo.api_url ?? "http://127.0.0.1:9090"),
    APISecret: String(rawMihomo.APISecret ?? rawMihomo.api_secret ?? ""),
    Routing: routing,
    TunDevice: String(rawMihomo.TunDevice ?? rawMihomo.tun_device ?? routing.TunDevice ?? "Meta"),
  };

  const rawLogging = ((typeof cfg.logging === "object" && cfg.logging !== null ? cfg.logging : cfg.Logging) || {}) as Record<string, unknown>;
  const logging: LoggingConfig = {
    level: String(rawLogging.level ?? rawLogging.Level ?? "info"),
    file: (rawLogging.file ?? rawLogging.File ?? "/var/log/mihombreng.log") as string,
    max_size: Number(rawLogging.max_size ?? rawLogging.MaxSize ?? 100),
    max_backups: Number(rawLogging.max_backups ?? rawLogging.MaxBackups ?? 3),
    max_age: Number(rawLogging.max_age ?? rawLogging.MaxAge ?? 28),
  };

  const rawAPI = ((typeof cfg.api === "object" && cfg.api !== null ? cfg.api : cfg.API) || {}) as Record<string, unknown>;
  const api: APIConfig = {
    RateLimit: Number(rawAPI.RateLimit ?? rawAPI.rate_limit ?? 100),
    Timeout: Number(rawAPI.Timeout ?? rawAPI.timeout ?? 30),
    EnableSwagger: Boolean(rawAPI.EnableSwagger ?? rawAPI.enable_swagger ?? true),
    AuthToken: (rawAPI.AuthToken ?? rawAPI.auth_token ?? "") as string,
  };

  const rawBackup = ((typeof cfg.backup === "object" && cfg.backup !== null ? cfg.backup : cfg.Backup) || undefined) as Record<string, unknown> | undefined;
  let backup: BackupConfig | undefined = undefined;
  if (rawBackup) {
    backup = {
      auto_backup_enabled: Boolean(rawBackup.auto_backup_enabled ?? rawBackup.AutoBackupEnabled ?? true),
      max_backups: Number(rawBackup.max_backups ?? rawBackup.MaxBackups ?? 10),
      max_age_days: Number(rawBackup.max_age_days ?? rawBackup.MaxAgeDays ?? 30),
      backup_dir: String(rawBackup.backup_dir ?? rawBackup.BackupDir ?? "/etc/mihombreng/backups"),
    };
  }

  return {
    version: String(cfg.version ?? cfg.Version ?? "0.0.0"),
    environment: String(cfg.environment ?? cfg.Environment ?? "development"),
    server,
    mihomo,
    logging,
    api,
    ...(backup ? { backup } : {}),
  };
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem("mihombreng_auth_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API}${endpoint}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error || body.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export const mihomoApi = {
  async getStatus(): Promise<MihomoStatus> {
    const r = await fetchApi<MihomoStatus>("/api/v1/mihomo/status");
    return r.data || { running: false };
  },
  async start(): Promise<void> {
    await fetchApi("/api/v1/mihomo/start", { method: "POST" });
  },
  async stop(): Promise<void> {
    await fetchApi("/api/v1/mihomo/stop", { method: "POST" });
  },
  async restart(): Promise<void> {
    await fetchApi("/api/v1/mihomo/restart", { method: "POST" });
  },
  async getMemory(): Promise<{ inuse: number; oslimit: number }> {
    const r = await fetchApi<{ inuse: number; oslimit: number }>("/api/v1/mihomo/snapshot/memory");
    return r.data || { inuse: 0, oslimit: 0 };
  },
  async getTraffic(): Promise<{ up: number; down: number }> {
    const r = await fetchApi<{ up: number; down: number }>("/api/v1/mihomo/snapshot/traffic");
    return r.data || { up: 0, down: 0 };
  },
  async getConnections(): Promise<{ total: number; uploadTotal: number; downloadTotal: number }> {
    const r = await fetchApi<{
      total: number;
      uploadTotal: number;
      downloadTotal: number;
    }>("/api/v1/mihomo/snapshot/connections");
    return r.data || { total: 0, uploadTotal: 0, downloadTotal: 0 };
  },
  async getTrafficMetrics(): Promise<TrafficMetrics> {
    const r = await fetchApi<TrafficMetrics>("/api/v1/mihomo/metrics/traffic");
    return r.data || { downloadTotal: 0, uploadTotal: 0, connections: 0, by_rule: [], by_chain: [], by_network: [], by_type: [] };
  },
  async getConnectionsList(): Promise<ConnectionsListResponse> {
    const r = await fetchApi<ConnectionsListResponse>("/api/v1/mihomo/metrics/connections");
    return r.data || { connections: [], downloadTotal: 0, uploadTotal: 0 };
  },
  async closeConnection(id: string): Promise<void> {
    await fetchApi(`/api/v1/mihomo/connections/${id}`, { method: "DELETE" });
  },
  async getCoreVersion(): Promise<string> {
    try {
      const r = await fetchApi<{ version: string }>("/api/v1/mihomo/core-version");
      return r.data?.version || "Unknown";
    } catch (err) {
      console.error(err);
      return "Unknown";
    }
  },
  async getDashboardInfo(): Promise<DashboardInfo> {
    const r = await fetchApi<DashboardInfo>("/api/v1/mihomo/dashboard-info");
    return r.data || { port: "9090", secret: "", dashboards: [] };
  },
  async getActiveConfig(): Promise<string> {
    try {
      const r = await fetchApi<{ active_config: string }>("/api/v1/mihomo/active-config");
      return r.data?.active_config || "";
    } catch (err) {
      console.error(err);
      return "";
    }
  },
  async setActiveConfig(filename: string): Promise<void> {
    await fetchApi("/api/v1/mihomo/active-config", {
      method: "PUT",
      body: JSON.stringify({ filename }),
    });
  },
  async saveConfig(filename: string, content: string): Promise<void> {
    await fetchApi(`/api/v1/mihomo/configs/${filename}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
  },
  async saveProxyProvider(filename: string, content: string): Promise<void> {
    await fetchApi(`/api/v1/mihomo/proxy-provider/${filename}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
  },
  async saveRuleProvider(filename: string, content: string): Promise<void> {
    await fetchApi(`/api/v1/mihomo/rule-provider/${filename}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
  },
  async validateConfig(filename: string, content: string): Promise<ConfigValidationResult> {
    const r = await fetchApi<ConfigValidationResult>("/api/v1/mihomo/configs/validate", {
      method: "POST",
      body: JSON.stringify({ filename, content }),
    });
    return r.data || { valid: false, summary: "Validation response missing", issues: [], checked_with: [] };
  },
  async autoFixConfig(content: string): Promise<ConfigAutoFixResult> {
    const r = await fetchApi<ConfigAutoFixResult>("/api/v1/mihomo/configs/autofix", {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    return r.data || { content: "", applied_fixes: [] };
  },
  async checkUpdate(): Promise<AppUpdateCheck | null> {
    try {
      const r = await fetchApi<AppUpdateCheck>("/api/v1/app/check-update");
      return r.data || null;
    } catch (err) {
      console.debug("Update check unavailable", err);
      return null;
    }
  },
  async getGeoIP(): Promise<{ ipv4: string; ipv6: string }> {
    const getOne = async (url: string) => {
      try {
        const r = await fetchApi<{ ip: string; country: string; organization: string }>(url);
        return r.data ? `${r.data.country} ${r.data.organization} (${r.data.ip})` : "";
      } catch (err) {
        console.error(err);
        return "";
      }
    };
    return {
      ipv4: await getOne("/api/v1/app/geo/ipv4"),
      ipv6: await getOne("/api/v1/app/geo/ipv6"),
    };
  },
  // ── Generic file CRUD helpers ──
  async _listFilesWithErrors(dir: string): Promise<{ data: string[]; errors: Record<string, string> }> {
    try {
      const r = await fetchApi<string[]>(`/api/v1/mihomo/${dir}`);
      return {
        data: r.data || [],
        errors: (r as { errors?: Record<string, string> }).errors || {},
      };
    } catch (err) {
      console.error(err);
      return { data: [], errors: {} };
    }
  },

  async _listFiles(dir: string): Promise<string[]> {
    try {
      const r = await fetchApi<string[]>(`/api/v1/mihomo/${dir}`);
      return r.data || [];
    } catch (err) {
      console.error(err);
      return [];
    }
  },

  async _createFile(dir: string, filename: string): Promise<void> {
    await fetchApi(`/api/v1/mihomo/${dir}`, {
      method: "POST",
      body: JSON.stringify({ filename }),
    });
  },

  async _uploadFile(dir: string, file: File): Promise<void> {
    const formData = new FormData();
    formData.append("file", file);
    const token = localStorage.getItem("mihombreng_auth_token");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    
    const res = await fetch(`/api/v1/mihomo/${dir}/upload`, {
      method: "POST",
      body: formData,
      headers,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body.error || `HTTP ${res.status}`);
    }
  },

  async _renameFile(dir: string, filename: string, newName: string): Promise<void> {
    await fetchApi(`/api/v1/mihomo/${dir}/${filename}/rename`, {
      method: "PUT",
      body: JSON.stringify({ new_filename: newName }),
    });
  },

  async _downloadFile(dir: string, filename: string): Promise<void> {
    const token = localStorage.getItem("mihombreng_auth_token");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    
    const res = await fetch(`/api/v1/mihomo/${dir}/${filename}/download`, { headers });
    if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async _deleteFile(dir: string, filename: string): Promise<void> {
    await fetchApi(`/api/v1/mihomo/${dir}/${filename}`, { method: "DELETE" });
  },

  // ── Configs ──
  async getConfigs(): Promise<string[]> {
    return this._listFiles("configs");
  },
  async getConfigContent(filename: string): Promise<string> {
    const r = await fetchApi<{ content: string }>(`/api/v1/mihomo/configs/${filename}`);
    return r.data?.content || "";
  },
  async createConfig(filename: string): Promise<void> {
    return this._createFile("configs", filename);
  },
  async uploadConfig(file: File): Promise<void> {
    return this._uploadFile("configs", file);
  },
  async renameConfig(filename: string, newName: string): Promise<void> {
    return this._renameFile("configs", filename, newName);
  },
  async downloadConfig(filename: string): Promise<void> {
    return this._downloadFile("configs", filename);
  },
  async deleteConfig(filename: string): Promise<void> {
    return this._deleteFile("configs", filename);
  },

  // ── Proxy Providers ──
  async getProxyProviders(): Promise<{ data: string[]; errors: Record<string, string> }> {
    return this._listFilesWithErrors("proxy-provider");
  },
  async getProxyProviderContent(filename: string): Promise<string> {
    const r = await fetchApi<{ content: string }>(`/api/v1/mihomo/proxy-provider/${filename}`);
    return r.data?.content || "";
  },
  async createProxyProvider(filename: string): Promise<void> {
    return this._createFile("proxy-provider", filename);
  },
  async uploadProxyProvider(file: File): Promise<void> {
    return this._uploadFile("proxy-provider", file);
  },
  async renameProxyProvider(filename: string, newName: string): Promise<void> {
    return this._renameFile("proxy-provider", filename, newName);
  },
  async downloadProxyProvider(filename: string): Promise<void> {
    return this._downloadFile("proxy-provider", filename);
  },
  async deleteProxyProvider(filename: string): Promise<void> {
    return this._deleteFile("proxy-provider", filename);
  },

  // ── Rule Providers ──
  async getRuleProviders(): Promise<{ data: string[]; errors: Record<string, string> }> {
    return this._listFilesWithErrors("rule-provider");
  },
  async getRuleProviderContent(filename: string): Promise<string> {
    const r = await fetchApi<{ content: string }>(`/api/v1/mihomo/rule-provider/${filename}`);
    return r.data?.content || "";
  },
  async createRuleProvider(filename: string): Promise<void> {
    return this._createFile("rule-provider", filename);
  },
  async uploadRuleProvider(file: File): Promise<void> {
    return this._uploadFile("rule-provider", file);
  },
  async renameRuleProvider(filename: string, newName: string): Promise<void> {
    return this._renameFile("rule-provider", filename, newName);
  },
  async downloadRuleProvider(filename: string): Promise<void> {
    return this._downloadFile("rule-provider", filename);
  },
  async deleteRuleProvider(filename: string): Promise<void> {
    return this._deleteFile("rule-provider", filename);
  },
  async syncProvider(dir: string, filename: string): Promise<void> {
    await fetchApi("/api/v1/mihomo/providers/sync", {
      method: "POST",
      body: JSON.stringify({ dir, filename }),
    });
  },
};

export const configApi = {
  async getConfig(): Promise<AppConfig> {
    const r = await fetchApi<unknown>("/api/v1/app/config");
    return normalizeAppConfig(r.data);
  },
  async updateConfig(config: Partial<AppConfig>): Promise<void> {
    await fetchApi("/api/v1/app/config", {
      method: "PUT",
      body: JSON.stringify(config),
    });
  },
  async getDiagnostics(): Promise<DiagnosticsResponse> {
    const token = localStorage.getItem("mihombreng_auth_token");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    
    const res = await fetch(`${API}/api/v1/app/diagnostics`, { headers });
    if (!res.ok) throw new ApiError(res.status, `HTTP ${res.status}`);
    return res.json();
  },
  async recoverDiagnostics(target: string): Promise<void> {
    await fetchApi("/api/v1/app/diagnostics/recover", {
      method: "POST",
      body: JSON.stringify({ target }),
    });
  },
  async validateRouting(routing: { TCP: string; UDP: string; tun_device?: string }): Promise<{ valid: boolean; issues: string[] }> {
    const r = await fetchApi<{ valid: boolean; issues: string[] }>("/api/v1/mihomo/routing/validate", {
      method: "POST",
      body: JSON.stringify(routing),
    });
    return r.data || { valid: false, issues: ["Failed to validate routing"] };
  },
};

export const backupApi = {
  async list(): Promise<BackupEntry[]> {
    try {
      const r = await fetchApi<BackupEntry[]>("/api/v1/backup/list");
      return r.data || [];
    } catch (err) {
      console.error(err);
      return [];
    }
  },
  async create(): Promise<BackupEntry> {
    const r = await fetchApi<BackupEntry>("/api/v1/backup/create", { method: "POST" });
    if (!r.data) throw new Error(r.error || "Backup create failed");
    return r.data;
  },
  async download(filename: string): Promise<void> {
    const token = localStorage.getItem("mihombreng_auth_token");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API}/api/v1/backup/download/${encodeURIComponent(filename)}`, { headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body.error || `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const cd = res.headers.get("Content-Disposition");
    a.download = cd ? cd.split("filename=")[1] : filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  async restore(file: File): Promise<void> {
    const formData = new FormData();
    formData.append("backup", file);
    const token = localStorage.getItem("mihombreng_auth_token");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API}/api/v1/backup/restore`, {
      method: "POST",
      body: formData,
      headers,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body.error || `HTTP ${res.status}`);
    }
  },
  async restoreFromHistory(filename: string): Promise<void> {
    const token = localStorage.getItem("mihombreng_auth_token");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API}/api/v1/backup/restore/${encodeURIComponent(filename)}`, {
      method: "POST",
      headers,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body.error || `HTTP ${res.status}`);
    }
  },
  async remove(filename: string): Promise<void> {
    const token = localStorage.getItem("mihombreng_auth_token");
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API}/api/v1/backup/${encodeURIComponent(filename)}`, {
      method: "DELETE",
      headers,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, body.error || `HTTP ${res.status}`);
    }
  },
  async status(): Promise<BackupStatus> {
    try {
      const r = await fetchApi<BackupStatus>("/api/v1/backup/status");
      return r.data || { last_backup_time: "", last_backup_source: "", backup_count: 0, total_size_bytes: 0, retention_applied: false };
    } catch (err) {
      console.error(err);
      return { last_backup_time: "", last_backup_source: "", backup_count: 0, total_size_bytes: 0, retention_applied: false };
    }
  },
  async applyRetention(): Promise<number> {
    const r = await fetchApi<{ deleted: number }>("/api/v1/backup/retention", { method: "POST" });
    return r.data?.deleted || 0;
  },
  // Remote target methods
  async listRemoteTargets(): Promise<RemoteBackupTarget[]> {
    try {
      const r = await fetchApi<RemoteBackupTarget[]>("/api/v1/backup/remote/list");
      return r.data || [];
    } catch (err) {
      console.error(err);
      return [];
    }
  },
  async testRemoteTarget(name: string): Promise<{ success: boolean; result: string }> {
    const r = await fetchApi<{ result: string }>(`/api/v1/backup/remote/test/${encodeURIComponent(name)}`, { method: "POST" });
    return { success: !!r.data, result: r.data?.result || "Unknown" };
  },
  async syncToRemote(name: string, filename?: string): Promise<string> {
    const r = await fetchApi<{ filename: string }>(`/api/v1/backup/remote/sync/${encodeURIComponent(name)}`, {
      method: "POST",
      body: JSON.stringify({ filename }),
    });
    return r.data?.filename || "";
  },
  async getRemoteSyncStatus(name: string): Promise<RemoteSyncStatus> {
    try {
      const r = await fetchApi<RemoteSyncStatus>(`/api/v1/backup/remote/status/${encodeURIComponent(name)}`);
      return r.data || { last_sync_time: "", last_sync_error: "", sync_count: 0, total_uploaded: 0 };
    } catch (err) {
      console.error(err);
      return { last_sync_time: "", last_sync_error: "", sync_count: 0, total_uploaded: 0 };
    }
  },
};

export const unlockTestApi = {
  async listUnlockTestTargets(): Promise<UnlockTestTarget[]> {
    try {
      const r = await fetchApi<UnlockTestTarget[]>("/api/v1/unlock-test/targets");
      return r.data || [];
    } catch (err) {
      console.error(err);
      return [];
    }
  },
  async runUnlockTest(targetId?: string): Promise<UnlockTestResult | UnlockTestResult[]> {
    const r = await fetchApi<UnlockTestResult | UnlockTestResult[]>("/api/v1/unlock-test/run", {
      method: "POST",
      body: JSON.stringify({ target_id: targetId }),
    });
    return r.data!;
  },
};

async function fetchRawJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("mihombreng_auth_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API}${endpoint}`, {
    ...options,
    headers,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, body.error || body.message || `HTTP ${res.status}`);
  }
  return body as T;
}

export const dnsApi = {
  async lookup(domain: string): Promise<DnsLookupResponse> {
    return fetchRawJson<DnsLookupResponse>("/api/v1/dns/lookup", {
      method: "POST",
      body: JSON.stringify({ domain }),
    });
  },
};

export const converterApi = {
  async parseUrl(url: string): Promise<ParseResponse> {
    return fetchRawJson<ParseResponse>("/api/v1/converter/parse", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
  },
  async parseContent(content: string): Promise<ParseResponse> {
    return fetchRawJson<ParseResponse>("/api/v1/converter/parse", {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  },
};

export const subscriptionApi = {
  async list(): Promise<SubscriptionProfile[]> {
    const r = await fetchApi<SubscriptionProfile[]>("/api/v1/subscriptions");
    return r.data || [];
  },
  async get(id: string): Promise<SubscriptionProfile> {
    const r = await fetchApi<SubscriptionProfile>(`/api/v1/subscriptions/${id}`);
    if (!r.data) throw new Error(r.error || "Subscription not found");
    return r.data;
  },
  async create(input: SubscriptionProfileInput): Promise<SubscriptionProfile> {
    const r = await fetchApi<SubscriptionProfile>("/api/v1/subscriptions", {
      method: "POST",
      body: JSON.stringify(input),
    });
    if (!r.data) throw new Error(r.error || "Create failed");
    return r.data;
  },
  async update(id: string, input: SubscriptionProfileInput): Promise<SubscriptionProfile> {
    const r = await fetchApi<SubscriptionProfile>(`/api/v1/subscriptions/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
    if (!r.data) throw new Error(r.error || "Update failed");
    return r.data;
  },
  async remove(id: string): Promise<void> {
    await fetchApi(`/api/v1/subscriptions/${id}`, { method: "DELETE" });
  },
  async refresh(id: string): Promise<SubscriptionProfile> {
    const r = await fetchApi<SubscriptionProfile>(`/api/v1/subscriptions/${id}/refresh`, {
      method: "POST",
    });
    if (!r.data) throw new Error(r.error || "Refresh failed");
    return r.data;
  },
};

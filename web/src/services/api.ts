import type { ApiResponse, MihomoStatus, AppConfig, DashboardInfo, ParseResponse, DnsLookupResponse, BackupEntry, BackupStatus, DiagnosticsResponse, ConfigValidationResult, SubscriptionProfile, SubscriptionProfileInput, TrafficMetrics, ConnectionsListResponse, RemoteBackupTarget, RemoteSyncStatus } from "@/types";

const API = "";

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
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
    await fetchApi(`/api/v1/mihomo/proxy-providers/${filename}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
  },
  async saveRuleProvider(filename: string, content: string): Promise<void> {
    await fetchApi(`/api/v1/mihomo/rule-providers/${filename}`, {
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
    return this._listFilesWithErrors("proxy-providers");
  },
  async getProxyProviderContent(filename: string): Promise<string> {
    const r = await fetchApi<{ content: string }>(`/api/v1/mihomo/proxy-providers/${filename}`);
    return r.data?.content || "";
  },
  async createProxyProvider(filename: string): Promise<void> {
    return this._createFile("proxy-providers", filename);
  },
  async uploadProxyProvider(file: File): Promise<void> {
    return this._uploadFile("proxy-providers", file);
  },
  async renameProxyProvider(filename: string, newName: string): Promise<void> {
    return this._renameFile("proxy-providers", filename, newName);
  },
  async downloadProxyProvider(filename: string): Promise<void> {
    return this._downloadFile("proxy-providers", filename);
  },
  async deleteProxyProvider(filename: string): Promise<void> {
    return this._deleteFile("proxy-providers", filename);
  },

  // ── Rule Providers ──
  async getRuleProviders(): Promise<{ data: string[]; errors: Record<string, string> }> {
    return this._listFilesWithErrors("rule-providers");
  },
  async getRuleProviderContent(filename: string): Promise<string> {
    const r = await fetchApi<{ content: string }>(`/api/v1/mihomo/rule-providers/${filename}`);
    return r.data?.content || "";
  },
  async createRuleProvider(filename: string): Promise<void> {
    return this._createFile("rule-providers", filename);
  },
  async uploadRuleProvider(file: File): Promise<void> {
    return this._uploadFile("rule-providers", file);
  },
  async renameRuleProvider(filename: string, newName: string): Promise<void> {
    return this._renameFile("rule-providers", filename, newName);
  },
  async downloadRuleProvider(filename: string): Promise<void> {
    return this._downloadFile("rule-providers", filename);
  },
  async deleteRuleProvider(filename: string): Promise<void> {
    return this._deleteFile("rule-providers", filename);
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
    const r = await fetchApi<AppConfig>("/api/v1/app/config");
    return r.data || { version: "0.0.0", environment: "development" } as AppConfig;
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

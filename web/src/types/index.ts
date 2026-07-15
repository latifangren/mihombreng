export interface MihomoStatus {
  running: boolean;
  uptime?: number;
  version?: string;
  memory?: number;
  cpu?: number;
  routing?: {
    active: boolean;
    healthy: boolean;
    error: string;
    latency: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface AppConfig {
  version: string;
  environment: string;
  server: ServerConfig;
  mihomo: MihomoConfig;
  logging: LoggingConfig;
  api: APIConfig;
}

export interface ServerConfig {
  Port: string;
  Host: string;
  Mode: string;
}

export interface MihomoConfig {
  CorePath: string;
  ConfigPath: string;
  WorkingDir: string;
  AutoRestart: boolean;
  AutoStart: boolean;
  LogFile: string;
  APIURL: string;
  APISecret: string;
  Routing: RoutingConfig;
}

export interface RoutingConfig {
  TCP: string;
  UDP: string;
  TunDevice: string;
  BypassMACs?: string[];
  BypassIPs?: string[];
  BypassIP6s?: string[];
}

export interface LoggingConfig {
  level: string;
}

export interface APIConfig {
  RateLimit: number;
  Timeout: number;
  EnableSwagger: boolean;
}

export interface DashboardInfo {
  port: string;
  secret: string;
  dashboards: string[];
}

export interface MihomoLog {
  id: string;
  kind: "log" | "status";
  source: string;
  level: string;
  message: string;
  timestamp: string;
  raw?: string;
  status?: string;
  code?: string;
}

export interface DiagnosticsCheck {
  id: string;
  label: string;
  category: "runtime" | "network" | "dns" | "filesystem";
  severity: "success" | "warning" | "failure";
  summary: string;
  details?: string;
  value?: string;
  action?: string;
}

export interface DiagnosticsResponse {
  success: boolean;
  generated_at: string;
  checks: DiagnosticsCheck[];
}

export interface ConfigValidationIssue {
  line?: number;
  column?: number;
  level: string;
  source: string;
  message: string;
}

export interface ConfigValidationResult {
  valid: boolean;
  summary: string;
  issues: ConfigValidationIssue[];
  checked_with: string[];
  normalized_to?: string;
}

export interface FileEntry {
  name: string;
  is_dir: boolean;
  size: number;
  modified: string;
}

export interface BackupEntry {
  filename: string;
  size: number;
  created: string;
  source: string;
}

export interface BackupStatus {
  last_backup_time: string;
  last_backup_source: string;
  backup_count: number;
  total_size_bytes: number;
  retention_applied: boolean;
}

export interface RemoteBackupTarget {
  name: string;
  type: string;
  url: string;
  username: string;
  enabled: boolean;
}

export interface RemoteSyncStatus {
  last_sync_time: string;
  last_sync_error: string;
  sync_count: number;
  total_uploaded: number;
}

export interface GeoIPInfo {
  ip: string;
  country: string;
  organization: string;
  city: string;
}

export interface ProxyNode {
  name: string;
  type: string;
  raw?: string;
  server: string;
  port: number;
  uuid?: string;
  password?: string;
  cipher?: string;
  udp?: boolean;
  tls?: boolean;
  sni?: string;
  alpn?: string[];
  network?: string;
  "ws-path"?: string;
  "grpc-service-name"?: string;
  flow?: string;
}

export interface ParseResponse {
  success: boolean;
  proxies?: ProxyNode[];
  count: number;
  error?: string;
}

export interface DnsLookupResponse {
  success: boolean;
  domain: string;
  ipv4: string[];
  ipv6: string[];
  error?: string;
  reason?: string;
}

export interface SubscriptionProfile {
  id: string;
  name: string;
  url: string;
  provider_filename: string;
  provider_path: string;
  update_interval: number;
  enabled: boolean;
  status: string;
  last_refresh_at?: string;
  last_success_at?: string;
  last_error?: string;
  proxy_count: number;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionProfileInput {
  name: string;
  url: string;
  provider_filename: string;
  update_interval: number;
  enabled: boolean;
}

export interface TrafficMetricBucket {
  key: string;
  download: number;
  upload: number;
  connections: number;
}

export interface TrafficMetrics {
  downloadTotal: number;
  uploadTotal: number;
  connections: number;
  by_rule: TrafficMetricBucket[];
  by_chain: TrafficMetricBucket[];
  by_network: TrafficMetricBucket[];
  by_type: TrafficMetricBucket[];
}

export interface ConnectionInfo {
  id: string;
  download: number;
  upload: number;
  download_display: string;
  upload_display: string;
  network: string;
  type: string;
  source_ip: string;
  source_port: number;
  destination_ip: string;
  destination_port: number;
  host: string;
  rule: string;
  rule_payload: string;
  chain: string;
  chains: string[];
}

export interface ConnectionsListResponse {
  connections: ConnectionInfo[];
  downloadTotal: number;
  uploadTotal: number;
}

export interface UnlockTestTarget {
  id: string;
  name: string;
  url?: string;
  host?: string;
  expected?: number;
  type: "http" | "tcp" | "dns";
}

export interface UnlockTestResult {
  id: string;
  status: "Yes" | "No" | "Failed";
  region?: string;
  checked_at: string;
  message?: string;
}

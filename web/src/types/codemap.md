# types/

## Responsibility
Shared TypeScript type definitions — provides the canonical interface contracts for all domain models used across the application's API layer, state management, and component props. Acts as the single source of truth for data shapes flowing between backend and frontend.

## Design
- **Flat module** — single `index.ts` file, all interfaces exported directly (no re-exports or namespaces).
- **API response envelope** — `ApiResponse<T>` provides generic `{ success, data?, message?, error? }` wrapper matching backend response format.
- **Domain model interfaces**:
  - `MihomoStatus` — core process state (`running`, `uptime`, `version`, `memory`, `cpu`, `routing`, `health`)
  - `AppConfig` — root config with nested `ServerConfig`, `MihomoConfig`, `LoggingConfig`, `APIConfig`, `BackupConfig`, `UnlockTestConfig`
  - `MihomoConfig` — PascalCase and snake_case field support (`CorePath`, `ConfigPath`, `APIURL`, `AutoRestartOpts`, etc.) matching Go backend struct tags
  - `RoutingConfig` — TCP/UDP routing mode, TUN device name, and bypass IP/MAC arrays
  - `AutoRestartSettings` — auto-restart conditions (`on_crash`, `on_config_change`, `on_network_change`, `on_routing_failure`, `schedule_enabled`, `schedule_interval`, `schedule_time`)
  - `CORSConfig` — cross-origin resource sharing configuration (`enabled`, `allowed_origins`, `allowed_methods`, `allowed_headers`, `expose_headers`, `allow_credentials`)
  - `APIConfig` — API server limits (`RateLimit`, `Timeout`, `EnableSwagger`, `AuthToken`, `cors`)
  - `UnlockTestTarget`, `UnlockTestTargetConfig`, `UnlockTestResult`, `UnlockTestConfig` — unlock testing models (target definitions, protocols `http`/`tcp`/`dns`, status results `Yes`/`No`/`Failed`, region codes)
  - `AppUpdateCheck` — system update check status (`has_update`, `current_version`, `latest_version`, `changelog`, `backup_warning`, `upgrade_hint`)
  - `DiagnosticsCheck`, `DiagnosticsResponse` — health diagnostics checks and severity metrics
  - `DashboardInfo` — mihomo dashboard metadata
  - `MihomoLog` — log entry shape
  - `FileEntry`, `BackupEntry` — file system entities with `source` field
  - `BackupStatus` — backup metrics (count, size, last backup time/source, retention state)
  - `GeoIPInfo` — geolocation data
  - `ConfigValidationResult`, `ConfigValidationIssue`, `ConfigAutoFixResult` — YAML validation and auto-fix results
  - `SubscriptionProfile`, `SubscriptionProfileInput` — subscription CRUD models
  - `TrafficMetrics`, `TrafficMetricBucket` — traffic aggregation by rule/chain/network/type
  - `ConnectionInfo`, `ConnectionsListResponse` — active connection metadata
  - `RemoteBackupTarget`, `RemoteSyncStatus` — remote backup target configuration and sync state
- **Naming convention** — PascalCase for interface names; field casing mixes camelCase (frontend-originated), snake_case, and PascalCase (Go-backend-originated).

## Flow
Types are imported by consumers at compile time only — no runtime presence. They enforce structural contracts between:
- `services/api.ts` return types → hooks state → component props
- `hooks/use-mihomo-status` → `MihomoStatus`
- `hooks/use-logs` → `MihomoLog`
- `app/settings/page.tsx` → `AppConfig`, `MihomoConfig`, `CORSConfig`, `AppUpdateCheck`, `AutoRestartSettings`
- `app/unlock-test/page.tsx` → `UnlockTestTarget`, `UnlockTestResult`
- `app/profiles/page.tsx` → `SubscriptionProfile`, `SubscriptionProfileInput`
- `app/traffic/page.tsx` → `TrafficMetrics`, `TrafficMetricBucket`
- `app/connections/page.tsx` → `ConnectionInfo`, `ConnectionsListResponse`
- `app/backup/page.tsx` → `BackupEntry`, `BackupStatus`, `RemoteBackupTarget`, `RemoteSyncStatus`
- `components/ui/update-warning-banner.tsx` → `AppUpdateCheck`

## Integration
- **Consumers**: `services/api.ts`, all hooks, all page components (`app/`, `app/settings/`, `app/unlock-test/`, `app/docs/`, etc.)
- **No external dependencies** — pure type definitions, zero runtime imports

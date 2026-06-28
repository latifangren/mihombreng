# types/

## Responsibility
Shared TypeScript type definitions — provides the canonical interface contracts for all domain models used across the application's API layer, state management, and component props. Acts as the single source of truth for data shapes flowing between backend and frontend.

## Design
- **Flat module** — single `index.ts` file, all interfaces exported directly (no re-exports or namespaces).
- **API response envelope** — `ApiResponse<T>` provides generic `{ success, data?, message?, error? }` wrapper matching backend response format.
- **Domain model interfaces**:
  - `MihomoStatus` — core process state (`running`, `uptime`, `version`, `memory`, `cpu`)
  - `AppConfig` — root config with nested `ServerConfig`, `MihomoConfig`, `LoggingConfig`, `APIConfig`, `BackupConfig`
  - `MihomoConfig` — PascalCase field names (`CorePath`, `ConfigPath`, `APIURL`, etc.) matching Go backend struct tags
  - `RoutingConfig` — TCP/UDP routing mode + TUN device
  - `DashboardInfo` — mihomo dashboard metadata
  - `MihomoLog` — log entry shape
  - `FileEntry`, `BackupEntry` — file system entities with `source` field
  - `BackupStatus` — backup metrics (count, size, last backup time/source, retention state)
  - `GeoIPInfo` — geolocation data
  - `ConfigValidationResult` — YAML validation with core check results
  - `SubscriptionProfile`, `SubscriptionProfileInput` — subscription CRUD models
  - `TrafficMetrics`, `TrafficMetricBucket` — traffic aggregation by rule/chain/network/type
  - `ConnectionInfo`, `ConnectionsListResponse` — active connection metadata
  - `RemoteBackupTarget`, `RemoteSyncStatus` — remote backup target configuration and sync state
- **Naming convention** — PascalCase for interface names; field casing mixes camelCase (frontend-originated) and PascalCase (Go-backend-originated).

## Flow
Types are imported by consumers at compile time only — no runtime presence. They enforce structural contracts between:
- `services/api.ts` return types → hooks state → component props
- `hooks/use-mihomo-status` → `MihomoStatus`
- `hooks/use-logs` → `MihomoLog`
- `app/settings/page.tsx` → `AppConfig`, `MihomoConfig`
- `app/profiles/page.tsx` → `SubscriptionProfile`, `SubscriptionProfileInput`
- `app/traffic/page.tsx` → `TrafficMetrics`, `TrafficMetricBucket`
- `app/connections/page.tsx` → `ConnectionInfo`, `ConnectionsListResponse`
- `app/backup/page.tsx` → `BackupEntry`, `BackupStatus`, `RemoteBackupTarget`, `RemoteSyncStatus`

## Integration
- **Consumers**: `services/api.ts`, all hooks, all page components
- **No external dependencies** — pure type definitions, zero runtime imports

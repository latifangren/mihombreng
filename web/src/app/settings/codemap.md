# app/settings/

## Responsibility
Application settings page — renders and edits the comprehensive `AppConfig` structure covering mihomo core paths, API connection settings, CORS security settings, routing mode (TCP/UDP), bypass IP/MAC rules, auto-restart triggers and schedules, logging parameters, and backup configurations. Renders system update warning banners, dataset freshness pills, and provides inline form editing with single-key/dual-cased configuration save actions.

## Design
- **Client-rendered page** — `"use client"` directive.
- **Config-driven form** — loads `AppConfig` from `configApi.getConfig()`, binds form controls to nested `config.server`, `config.mihomo`, `config.logging`, `config.api`, `config.backup`, and `config.api.cors` objects.
- **Normalizer & Serializer integration** — uses `normalizeAppConfig` on fetch and `serializeAppConfig` on submission via `configApi` to maintain dual-casing compatibility (`snake_case`, `camelCase`, `PascalCase`).
- **Rich State Feedback & Update Banners**:
  - `UpdateWarningBanner` — displays application release availability, changelog previews, and backup recommendations.
  - `DataState` & `FreshnessPill` — provides feedback on configuration loading, error states, and last refresh timestamps.
- **Sub-components & Layout Sectioning**:
  - Cards for System Update Status, App Info, Core Paths & Process Control, Auto-Restart Triggers & Schedule, Transparent Proxy & Routing, API & CORS Security, Logging, and Backup Retention.
  - Private helper components (`ConfigRow`, `ConfigInput`, `ConfigSelect`, `ConfigCheckbox`) structure label + input fields.
- **Parallel data fetch** — `Promise.all` loads configuration, core version, update checks, and available config files on mount/refresh.

## Flow
1. Page mounts → `fetchData()` calls `configApi.getConfig()`, `mihomoApi.getCoreVersion()`, `configApi.checkUpdate()`, and `mihomoApi.getConfigs()` in parallel.
2. Loading state displays `SettingsSkeleton` placeholders; errors present a `DataState` warning container with retry capability.
3. Form populates normalized configuration; user changes fields → handlers produce updated `config` state, synchronizing nested `auto_restart_opts` and `Routing` fields.
4. User clicks Save → `handleSubmit()` invokes `configApi.updateConfig()`, serializing dual-cased/snake_case JSON payload to `/api/v1/app/config`.
5. Success toast notifies user; `FreshnessPill` updates timestamp.

## Integration
- **Services**: `services/api` → `configApi.getConfig()`, `configApi.updateConfig()`, `configApi.checkUpdate()`, `mihomoApi.getCoreVersion()`, `mihomoApi.getConfigs()`
- **Types**: `types/index` → `AppConfig`, `MihomoConfig`, `RoutingConfig`, `AutoRestartSettings`, `CORSConfig`, `AppUpdateCheck`
- **Components**: `ui/card`, `ui/retro-btn`, `ui/skeleton`, `ui/data-state`, `ui/update-warning-banner`
- **Icons**: `lucide-react` (Sliders, Save, AlertTriangle, RefreshCcw, Shield, Server, Database, Lock, Globe)
- **Notifications**: `react-hot-toast`

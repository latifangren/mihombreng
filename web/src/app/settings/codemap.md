# app/settings/

## Responsibility
Application settings page — renders and edits the `AppConfig` structure covering mihomo core paths, API connection settings, routing mode (TCP/UDP), auto-restart toggle, and application logging level. Provides inline form editing with a global save action.

## Design
- **Client-rendered page** — `"use client"` directive.
- **Config-driven form** — loads `AppConfig` from `configApi.getConfig()`, renders form fields bound to nested `config.mihomo` and `config.logging` objects.
- **Immutable state updates** — `handleChange` and `handleRoutingChange` produce shallow copies of nested config objects (spread pattern).
- **Helper sub-components** — four private components (`ConfigRow`, `ConfigInput`, `ConfigSelect`, `ConfigCheckbox`) provide consistent form row layout with label + control.
- **Three sections** — App Info (read-only version/environment/core version), Mihomo Configuration (editable fields), Application Logging (log level select).
- **Parallel data fetch** — `Promise.all` loads config, core version, and available config file list on mount.

## Flow
1. Page mounts → `fetchData()` calls `configApi.getConfig()`, `mihomoApi.getCoreVersion()`, `mihomoApi.getConfigs()` in parallel.
2. Loading state shows `SkeletonConfigLine` placeholders; null config shows error state.
3. Form renders with current values; user edits fields → `handleChange` / `handleRoutingChange` / `handleLogLevelChange` update local `config` state.
4. User clicks Save → `handleSubmit()` PUTs `{ mihomo, logging }` to `/api/v1/app/config`.
5. Config Path select dropdown populates from `availableConfigs` fetched from the backend.

## Integration
- **Services**: `services/api` → `configApi.getConfig()`, `configApi.updateConfig()`, `mihomoApi.getCoreVersion()`, `mihomoApi.getConfigs()`
- **Types**: `types/index` → `AppConfig`, `MihomoConfig`
- **Components**: `ui/card`, `ui/retro-btn`, `ui/skeleton`
- **Icons**: `lucide-react` (Sliders, Save)
- **Notifications**: `react-hot-toast`

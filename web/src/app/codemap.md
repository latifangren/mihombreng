# app/

## Responsibility
Application root — the main dashboard page rendering the Mihombreng system overview. Composes status hooks, statistics hooks, presentational components, and system route pages into a unified control panel with live-updating metrics (uptime, memory, traffic, connections), core status cards, and a terminal-style status display. Also defines top-level route pages including system documentation (`app/docs`) and service unlock testing (`app/unlock-test`).

## Design
- **Next.js-style `"use client"` page routing structure** — client-rendered React page components exported as defaults under `src/app/`.
- **Hook-driven data layer** — `useMihomoStatus()` and `useMihomoStats()` provide reactive state; main page has zero direct API calls.
- **Component composition** — `StatsRow`, `StatusCard`, `Terminal`, `RetroBandwidthChart`, `DataState`, `UpdateWarningBanner` are presentational children; `Skeleton*` variants shown during loading state.
- **Route Pages**:
  - `page.tsx` — main dashboard overview.
  - `docs/page.tsx` — routing configuration documentation, transparent proxy parameters (`tproxy`, `tun`, `redirect`), netfilter rules, and link to official MetaCubeX wiki.
  - `unlock-test/page.tsx` — media/streaming service unlock testing page. Queries targets, runs connectivity/unlock checks via `unlockTestApi`, displays status (`Yes`, `No`, `Failed`), country flag badges, and regional details.
- **Global CSS theme** — Tailwind v4 `@theme` block defines a retro dark palette (green primary, amber warning, cyan info), custom font families (`Archivo Black`, `Space Grotesk`, `JetBrains Mono`), and keyframe animations (`blink`, `float`, `float-slow`) for terminal cursor and decorative floating shapes.
- **Formatting utilities** — `formatBytes`, `formatDuration`, `formatTraffic` from `@/utils/format` transform raw numbers for display.

## Flow
1. `DashboardPage` mounts → `useMihomoStatus()` polls `/api/v1/mihomo/status` + `/api/v1/mihomo/core-version` every 5s.
2. `useMihomoStats()` polls `/api/v1/mihomo/snapshot/{memory,traffic,connections}` every 3s.
3. While `loading === true`, skeleton placeholders render (stat boxes, cards, terminal).
4. Once loaded, `StatsRow` renders uptime/memory/traffic stats; `StatusCard` components render core status/version/connections; `Terminal` renders a static status summary.
5. Navigation links route to specialized pages such as `app/docs` (routing reference) and `app/unlock-test` (service unlock matrix).

## Integration
- **Hooks**: `use-mihomo-status`, `use-mihomo-stats`
- **Components**: `status/status-card`, `status/stats-row`, `status/retro-bandwidth-chart`, `terminal/terminal`, `ui/skeleton`, `ui/data-state`, `ui/update-warning-banner`
- **Services**: `services/api` → `unlockTestApi`
- **Utils**: `utils/format` (formatBytes, formatDuration, formatTraffic)
- **Icons**: `lucide-react` (Activity, Cpu, MemoryStick, Globe, RefreshCcw, Wifi, BookOpen, Settings)
- **Styles**: `global.css` — Tailwind v4 theme, animations, scrollbar customization

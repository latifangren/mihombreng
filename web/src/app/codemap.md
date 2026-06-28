# app/

## Responsibility
Application root — the main dashboard page rendering the Mihombreng system overview. Composes status hooks, statistics hooks, and presentational components into a unified control panel with live-updating metrics (uptime, memory, traffic, connections), core status cards, and a terminal-style status display. Also defines the global CSS theme (dark retro aesthetic, custom colors, fonts, animations).

## Design
- **Next.js-style `"use client"` page** — client-rendered React component exported as default from `page.tsx`.
- **Hook-driven data layer** — `useMihomoStatus()` and `useMihomoStats()` provide reactive state; page has zero direct API calls.
- **Component composition** — `StatsRow`, `StatusCard`, `Terminal` are pure presentational children; `Skeleton*` variants shown during loading state.
- **Global CSS theme** — Tailwind v4 `@theme` block defines a retro dark palette (green primary, amber warning, cyan info), custom font families (`Archivo Black`, `Space Grotesk`, `JetBrains Mono`), and keyframe animations (`blink`, `float`, `float-slow`) for terminal cursor and decorative floating shapes.
- **Formatting utilities** — `formatBytes`, `formatDuration`, `formatTraffic` from `@/utils/format` transform raw numbers for display.

## Flow
1. `DashboardPage` mounts → `useMihomoStatus()` polls `/api/v1/mihomo/status` + `/api/v1/mihomo/core-version` every 5s.
2. `useMihomoStats()` polls `/api/v1/mihomo/snapshot/{memory,traffic,connections}` every 3s.
3. While `loading === true`, skeleton placeholders render (4 stat boxes, 3 cards, 1 terminal).
4. Once loaded, `StatsRow` renders uptime/memory/traffic stats; 3 `StatusCard` components render core status/version/connections; `Terminal` renders a static status summary.
5. `isRunning` derived from `status.running` drives conditional styling (green/red indicators, enabled/disabled states).

## Integration
- **Hooks**: `use-mihomo-status`, `use-mihomo-stats`
- **Components**: `status/status-card`, `status/stats-row`, `terminal/terminal`, `ui/skeleton`
- **Utils**: `utils/format` (formatBytes, formatDuration, formatTraffic)
- **Icons**: `lucide-react` (Activity, Cpu, MemoryStick, Globe)
- **Styles**: `global.css` — Tailwind v4 theme, animations, scrollbar customization

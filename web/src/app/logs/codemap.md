# app/logs/

## Responsibility
Log viewer page — displays a filterable list of log entries in a terminal-styled container. Currently renders hardcoded demo log data with level-based filtering. Designed as a placeholder/prototype for future WebSocket-driven live log streaming.

## Design
- **Static demo data** — `DEMO_LOGS` array contains 8 hardcoded `LogEntry` objects with `level`, `message`, and `timestamp` fields.
- **Client-side filtering** — `filter` state selects log level; `useMemo` computes filtered list.
- **Level filter buttons** — horizontal button row for "all", "info", "warning", "error", "debug" with active/inactive styling using retro neumorphic shadow treatment.
- **Terminal presentation** — logs rendered inside `Terminal` → `LogLine` components within a scrollable container (`max-h-[60vh]`).
- **No `"use client"` directive** — page uses React hooks (`useState`, `useMemo`) so it must be client-rendered via framework conventions.

## Flow
1. Page renders with `filter` initialized to `"all"`.
2. All 8 `DEMO_LOGS` entries render inside the terminal via `LogLine` components.
3. User clicks a level filter button → `setFilter(lvl)` → `useMemo` recomputes `filtered` array.
4. Only matching log entries re-render in the terminal.

## Integration
- **Components**: `terminal/terminal`, `terminal/log-line`, `ui/card`
- **Data**: Static `DEMO_LOGS` array (no API calls currently)
- **Types**: Local `LogEntry` interface (`{ level, message, timestamp }`)

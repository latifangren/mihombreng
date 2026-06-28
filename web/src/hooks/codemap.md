# hooks/

## Responsibility
Custom React hooks providing reactive data layers for the application. Each hook encapsulates polling, WebSocket streaming, or state management logic with automatic cleanup, abstracting backend communication away from page components.

## Design
- **Polling hooks** (`use-mihomo-status`, `use-mihomo-stats`) — use `setInterval` + `useCallback`/`useEffect` for periodic data fetching with configurable intervals (5s for status, 3s for stats). Cleanup via `clearInterval` in effect teardown.
- **WebSocket hook** (`use-logs`) — manages a persistent WebSocket connection via `createLogStream`, with connection state tracking and bounded log buffer (MAX_LOGS=500 using ring-buffer slice pattern).
- **Error-resilient fetching** — polling hooks silently catch errors (set default state), never crash the consumer component.
- **Minimal return types** — hooks return plain objects: `{ status, loading, refetch }`, `stats`, `{ logs, connected, clear }`.

## Flow
- **`useMihomoStatus`**: mounts → `fetch()` calls `mihomoApi.getStatus()` + `mihomoApi.getCoreVersion()` in parallel → merges version into status → starts 5s interval. Returns `{ status: MihomoStatus, loading: boolean, refetch: () => void }`.
- **`useMihomoStats`**: mounts → `fetch()` calls `mihomoApi.getMemory()`, `mihomoApi.getTraffic()`, `mihomoApi.getConnections()` in parallel → updates stats object → starts 3s interval. Returns `Stats` object directly.
- **`useLogs(endpoint)`**: mounts → `createLogStream(endpoint, onMessage, onError)` opens WebSocket → incoming JSON messages appended to `logs` array (capped at 500) → cleanup closes WebSocket. Returns `{ logs: MihomoLog[], connected: boolean, clear: () => void }`.

## Integration
- **Consumers**: `app/page.tsx` (useMihomoStatus, useMihomoStats), `app/mihomo/page.tsx` (useMihomoStatus)
- **Services**: `services/api` → `mihomoApi.*`, `services/ws` → `createLogStream`
- **Types**: `types/index` → `MihomoStatus`, `MihomoLog`

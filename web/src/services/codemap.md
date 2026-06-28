# services/

## Responsibility
Backend communication layer — provides typed HTTP API clients and a WebSocket stream factory. All server interactions flow through this module, abstracting fetch mechanics, error handling, and protocol selection.

## Design
- **Generic `fetchApi<T>` wrapper** — centralizes HTTP fetch with JSON content-type header, intercepts requests to append `Authorization: Bearer <token>` (if `mihombreng_auth_token` is present in `localStorage`), handles non-OK response mappings, and returns unmarshalled `ApiResponse<T>`.
- **`ApiError` class** — extends `Error` with HTTP `status` code for downstream error handling.
- **API namespace objects** — domain-specific API clients exported as plain objects:
  - `mihomoApi` — core process lifecycle, config CRUD, snapshots, GeoIP, providers, config validation, diagnostics, traffic metrics, connections
  - `configApi` — app configuration read/write
  - `backupApi` — backup list/create/restore/delete, status, retention, remote target list/test/sync/status
  - `dnsApi` — DNS lookup
  - `converterApi` — subscription URL parsing
  - `subscriptionApi` — subscription profile CRUD and refresh
  - `connectionsApi` — connection list and close
  - `trafficApi` — traffic metrics
- **WebSocket factory** (`ws.ts`) — `createLogStream(endpoint, onMessage, onError)` constructs protocol-aware WebSocket URL (`ws:`/`wss:` based on `window.location`), appends `token` in query parameter and `Sec-WebSocket-Protocol` subprotocol array for authentication, parses JSON messages, and returns `{ close }` handle.
- **Base URL** — empty string `API = ""` assumes same-origin proxy; all endpoints are relative paths under `/api/v1/`.

## Flow
- **HTTP pattern**: Consumer calls `mihomoApi.getStatus()` → `fetchApi<MihomoStatus>("/api/v1/mihomo/status")` → `fetch(API + endpoint)` → response parsed → `ApiResponse.data` returned or default fallback.
- **WebSocket pattern**: Consumer calls `createLogStream("/ws/logs", callback)` → WebSocket URL derived from current host → `ws.onmessage` parses JSON → invokes `onMessage({ level, message, timestamp })` → consumer returns `{ close }` for cleanup.

## Integration
- **Consumers**: All hooks, all page components (`app/backup`, `app/manager`, `app/mihomo`, `app/mihomo/config`, `app/settings`, `app/tools`, `app/logs`, `app/profiles`, `app/traffic`, `app/connections`)
- **Types**: `types/index` → all domain interfaces
- **API endpoints**: REST under `/api/v1/{mihomo,app,backup,dns,converter,subscriptions}/`, WebSocket at dynamic paths

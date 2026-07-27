# services/

## Responsibility
Backend communication layer — provides typed HTTP API clients and a WebSocket stream factory. All server interactions flow through this module, abstracting fetch mechanics, error handling, protocol selection, and dual-casing normalization/serialization for configuration payloads.

## Design
- **Generic `fetchApi<T>` & `fetchRawJson<T>` wrappers** — centralize HTTP fetch with JSON content-type header, intercept requests to append `Authorization: Bearer <token>` (if `mihombreng_auth_token` is present in `localStorage`), handle non-OK response mappings, and return unmarshalled data.
- **`ApiError` class** — extends `Error` with HTTP `status` code for downstream error handling.
- **Dual-Casing Normalization & Serialization**:
  - `normalizeAppConfig(raw)` — converts incoming raw backend configuration objects (handling `camelCase`, `snake_case`, or `PascalCase` key variants) into standardized frontend `AppConfig` structures with predictable field defaults.
  - `serializeAppConfig(config)` — transforms `AppConfig` objects for request payloads, outputting single-key `snake_case` properties as well as dual-cased (`camelCase`/`PascalCase` and `snake_case`) key mappings to guarantee seamless backend Go struct unmarshaling across YAML and JSON endpoints.
- **API namespace objects** — domain-specific API clients exported as plain objects:
  - `mihomoApi` — core process lifecycle, config CRUD, snapshots, GeoIP, providers, config validation, diagnostics, traffic metrics, connections
  - `configApi` — app configuration read/write, config normalization/serialization, version/update checks
  - `backupApi` — backup list/create/restore/delete, status, retention, remote target list/test/sync/status
  - `unlockTestApi` — list unlock test targets, run media/service unlock tests
  - `dnsApi` — DNS lookup
  - `converterApi` — subscription URL parsing
  - `subscriptionApi` — subscription profile CRUD and refresh
- **WebSocket factory** (`ws.ts`) — `createLogStream(endpoint, onMessage, onError)` constructs protocol-aware WebSocket URL (`ws:`/`wss:` based on `window.location`), appends `token` in query parameter and `Sec-WebSocket-Protocol` subprotocol array for authentication, parses JSON messages, and returns `{ close }` handle.
- **Base URL** — empty string `API = ""` assumes same-origin proxy; all endpoints are relative paths under `/api/v1/`.

## Flow
- **HTTP pattern**: Consumer calls `mihomoApi.getStatus()` → `fetchApi<MihomoStatus>("/api/v1/mihomo/status")` → `fetch(API + endpoint)` → response parsed → `ApiResponse.data` returned or default fallback.
- **Config Update pattern**: Consumer calls `configApi.updateConfig(config)` → `serializeAppConfig(config)` builds single-key `snake_case` and dual-cased payload → `fetchApi("/api/v1/app/config", { method: "PUT", body: JSON.stringify(...) })` → response unmarshalled and normalized via `normalizeAppConfig`.
- **WebSocket pattern**: Consumer calls `createLogStream("/ws/logs", callback)` → WebSocket URL derived from current host → `ws.onmessage` parses JSON → invokes `onMessage({ level, message, timestamp })` → consumer returns `{ close }` for cleanup.

## Integration
- **Consumers**: All hooks, all page components (`app/backup`, `app/manager`, `app/mihomo`, `app/mihomo/config`, `app/settings`, `app/tools`, `app/logs`, `app/profiles`, `app/traffic`, `app/connections`, `app/docs`, `app/unlock-test`)
- **Types**: `types/index` → all domain interfaces (`AppConfig`, `UnlockTestTarget`, `UnlockTestResult`, `RemoteBackupTarget`, etc.)
- **API endpoints**: REST under `/api/v1/{mihomo,app,backup,dns,converter,subscriptions,unlock-test}/`, WebSocket at dynamic paths

# handler/

## Responsibility
HTTP handler layer for REST endpoints and WebSocket streaming connections in the Gin web framework. Receives HTTP requests, validates payload inputs, delegates business logic to underlying service layers, and returns structured JSON responses or upgrades connections.

## Design
- **Handler Struct Pattern**: Handlers are defined as structs encapsulating their respective service dependencies (e.g. `NewHandler(service)`).
- **Sub-modules**:
  - `app/` (`app/handler.go`): Application config CRUD, diagnostics, public IP detection, GeoIP lookup.
  - `backup/` (`backup/backup.go`, `backup/remote.go`): Backup lifecycle, retention policy management, backup restoration/deletion, and WebDAV remote target operations.
  - `converter/` (`converter/converter.go`): REST API for proxy link parsing and subscription feed conversion.
  - `dns/` (`dns/dns.go`): Domain name resolution endpoints to IPv4/IPv6 addresses.
  - `mihomo/` (`mihomo/mihomo.go`, `mihomo/files.go`): Mihomo daemon control, external API reverse-proxying, configuration file management, validation, metrics, version, and web dashboard assets.
  - `stream/` (`stream/stream.go`): WebSocket streaming endpoints for real-time logs, traffic stats, memory usage, and active connection tracking.
  - `subscription/` (`subscription/handler.go`): Subscription profile management, CRUD operations, manual refresh, and YAML materialization.
  - `unlocktest/` (`unlocktest/handler.go`): Connectivity and streaming service unlock test endpoints (`/unlock-test/targets`, `/unlock-test/run`).

## Flow
1. Incoming HTTP request matches registered Gin route in `router.Setup()`.
2. Middleware (CORS, TokenAuth, RateLimit) processes request context.
3. Handler method binds request body / query parameters (e.g., `RunTestInput` with `target_id` or fallback query/form param in `unlocktest/handler.go`).
4. Handler calls corresponding service method (e.g., `unlockservice.Service.RunTest` or `RunAll`).
5. Handler serializes service result into standardized JSON envelope (`{"success": true, "data": ...}`).

## Integration
- **Depends on**: `internal/service/*` (including `service/unlocktest`, `service/backup`, `service/subscription`, etc.), `pkg/config`.
- **Used by**: `internal/http/router` (registers all handler methods on the Gin engine).


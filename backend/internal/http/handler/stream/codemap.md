# handler/stream/

## Responsibility
HTTP handlers for real-time WebSocket streaming of log files and mihomo API data (traffic, memory, connections). Provides live tail functionality for both mihomo and application log files, plus proxied SSE/WebSocket streams from mihomo's internal API endpoints.

## Design
- **Struct handler pattern**: `StreamHandler` holds `*config.Config` and `domain.MihomoService`. Constructor `NewStreamHandler()`.
- **WebSocket upgrade**: Uses `gorilla/websocket.Upgrader` (permissive `CheckOrigin`) to upgrade HTTP connections for bidirectional streaming.
- **File tailing engine**: `streamLogFile()` implements a poll-based log tailer: reads last 4KB on connect, then polls every 500ms for new data, handling file truncation (log rotation).
- **SSE proxy**: `streamMihomoAPI()` connects to mihomo's SSE endpoints, reads the response stream, and relays each line over WebSocket.
- **Polling proxy**: `StreamConnections()` polls `/connections` every 1 second via HTTP and pushes JSON to WebSocket (non-SSE endpoint).
- **Log clearing**: `ClearMihomoLogs` delegates to service; `ClearAppLogs` truncates the log file directly.

## Flow
- **StreamMihomoLogs/StreamAppLogs**: WebSocket upgrade -> check mihomo running (mihomo only) -> resolve log file path -> `streamLogFile()`.
- **streamLogFile**: Open file -> seek to last 4KB -> send initial lines -> seek to end -> poll ticker (500ms) -> read new bytes -> split by newline -> write each line to WebSocket. Exits on context cancellation.
- **StreamTraffic/StreamMemory**: WebSocket upgrade -> check running -> `streamMihomoAPI()` with `/traffic` or `/memory` endpoint -> connect to mihomo SSE -> relay lines.
- **StreamConnections**: WebSocket upgrade -> check running -> poll loop (1s) -> HTTP GET to `/connections` -> write raw JSON to WebSocket.
- **ClearMihomoLogs**: Delegate to `mihomoService.ClearLogs()`.
- **ClearAppLogs**: Open log file with `O_WRONLY|O_TRUNC` to truncate.

## Integration
- **Depends on**: `domain.MihomoService` (for `GetStatus`, `ClearLogs`), `pkg/config.Config` (APIURL, APISecret, LogFile, Logging.File), `pkg/apperror`.
- **External**: `gorilla/websocket` for WebSocket upgrade.
- **Consumed by**: `router.Setup()` registers WebSocket endpoints under `/api/v1/mihomo/{logs,memory,traffic,connections}` and `/api/v1/app/{logs}`.

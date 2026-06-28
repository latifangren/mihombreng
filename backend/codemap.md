# backend/

## Responsibility
Go backend for Mihombreng — Gin-based HTTP server providing REST API for Mihomo (Clash Meta) process management, configuration, proxy subscription conversion, DNS lookup, backup/restore, and real-time log streaming. Serves an embedded React SPA for the web dashboard.

## Sub-modules
| Directory | Responsibility | Map |
|-----------|---------------|-----|
| `cmd/server/` | Application entrypoint — DI composition, Gin bootstrap, graceful shutdown | [View](cmd/server/codemap.md) |
| `internal/` | Core business logic — HTTP handlers, services, domain interfaces, converter, embedded UI | [View](internal/codemap.md) |
| `pkg/` | Shared libraries — config loader, logger, typed error handling | [View](pkg/codemap.md) |
| `docs/` | Auto-generated Swagger 2.0 API documentation | [View](docs/codemap.md) |

## Tech Stack
- **Framework**: Gin (HTTP router/middleware)
- **Logging**: zerolog (structured, leveled)
- **Config**: go-yaml (YAML load/save)
- **Process**: os/exec (Mihomo lifecycle)
- **Networking**: gorilla/websocket (log streaming), net (DNS lookup)
- **Build**: Go 1.x, CGO_ENABLED=0 for static binaries

## Key Files
| File | Purpose |
|------|---------|
| `go.mod` | Module definition and dependency manifest |
| `Makefile` | Build targets for single/multi-arch compilation |
| `.air.toml` | Hot-reload configuration for development |

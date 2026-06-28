# Architecture

Mihombreng is a Go backend + React frontend for managing Mihomo (Clash Meta) on OpenWrt and Linux servers. The Go server handles routing, proxy lifecycle, and nftables rules. The browser connects over HTTP; WebSocket provides real-time log streaming.

## Topology

```text
Browser (phone/tablet/PC)
  |
  | HTTP + WebSocket
  v
Go Gin server (default :7777)
  |
  +-- middleware: CORS
  +-- internal/http/handler: per-domain route handlers
  +-- internal/service: Mihomo lifecycle, nftables, TUN/TProxy/Redirect
  +-- internal/domain: service interfaces
  +-- internal/converter: proxy URL parser (VMess, VLESS, Trojan, SS)
  +-- internal/ui/embed: serves React SPA from embedded FS
  +-- pkg/config: YAML config loader
  +-- pkg/logger: zerolog
```

## Request Flow

1. HTTP request arrives at Go server.
2. CORS middleware runs.
3. Route handler in `internal/http/handler/` delegates to service.
4. Service in `internal/service/` uses `exec.Command` (Mihomo lifecycle) and Go nftables bindings.
5. Handler returns JSON response.
6. For WebSocket endpoints (logs), handler upgrades connection and streams Mihomo stdout.

## Responsibility Split

| Layer | Owns | Must Not |
|---|---|---|
| `cmd/server` | Bootstrap, wire dependencies | Contain business logic |
| `internal/http/handler` | HTTP request parsing, JSON responses | Execute OS commands directly |
| `internal/service` | Mihomo lifecycle, nftables, TUN/TProxy | Import `internal/http` |
| `internal/domain` | Service interface definitions | Contain implementations |
| `internal/converter` | Proxy URL parsing | Handle HTTP |
| `pkg/config` | YAML config loading, defaults | Contain service logic |
| `pkg/logger` | Structured logging setup | Contain business logic |
| `web/` | React SPA, Tailwind CSS, routing | Contain Go code |

## Dependency Direction

Allowed:

```text
cmd/server --> internal/http/handler --> internal/service --> internal/domain
cmd/server --> internal/ui (embed)
internal/service --> pkg/config, pkg/logger
internal/converter --> (standalone)
```

Forbidden (circular):

```text
internal/service -/-> internal/http
internal/domain -/-> internal/service
pkg/* -/-> internal/*
```

## Key Decisions

| Decision | Rationale |
|---|---|
| Go + Gin (lightweight router) | Fast HTTP routing, middleware support, stdlib compatible |
| Embed frontend in binary | Single binary deployment, no separate file serving |
| Interface-based services | Testability, mock-friendly |
| Mihomo REST API for control | Avoid shelling out for start/stop/status |
| nftables via Go bindings | Direct kernel API, no CLI dependency, type-safe |
| React + Vite + Tailwind | Modern SPA with fast HMD and utility CSS |

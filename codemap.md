# Repository Atlas: mihombreng

## Project Responsibility
Controller and manager for Mihomo (Clash Meta) proxy core on OpenWrt and Linux servers. Provides a Go/Gin backend REST API with an embedded React SPA dashboard for process lifecycle management, proxy configuration, subscription conversion, DNS lookup, backup/restore (local + remote WebDAV), traffic monitoring, connection inspection, and real-time log streaming.

## System Entry Points
- `backend/cmd/server/main.go` — Go application entrypoint, DI composition, Gin bootstrap
- `web/src/main.tsx` — React SPA entrypoint, renders App with React Router
- `web/index.html` — HTML shell for Vite SPA
- `Makefile` — Build orchestration (backend + web + packaging)
- `defaults/mihombreng.yaml` — Application-level configuration

## Milestone Status
- **M1 ✅** Logs and Diagnostics Baseline
- **M2 ✅** Provider and Backup Operations
- **M3 ✅** Config Editor Maturity
- **M4 ✅** Profiles / Subscriptions Workspace
- **M5 ✅** Traffic and Connections Workspace
- **M6 ✅** Backup Safety and Restore Policies
- **M7 ✅** Auth, Audit, Hardening
- **M8.1 ⏸️** Routing Modes (deferred)
- **M8.2 ✅** OpenWrt Distribution Maturity

## Directory Map

### Backend (Go/Gin)
| Directory | Responsibility | Map |
|-----------|---------------|-----|
| `backend/cmd/server/` | Entrypoint — DI wiring, Gin setup, graceful shutdown | [View](backend/cmd/server/codemap.md) |
| `backend/internal/http/` | HTTP layer — router, middleware, route handlers (7 domains) | [View](backend/internal/http/codemap.md) |
| `backend/internal/service/` | Mihomo lifecycle, nftables routing, backup service, subscription service | [View](backend/internal/service/codemap.md) |
| `backend/internal/converter/` | Proxy subscription parser (vmess/vless/trojan/ss) | [View](backend/internal/converter/codemap.md) |
| `backend/internal/domain/` | Interface contracts (MihomoService, NftablesService) | [View](backend/internal/domain/codemap.md) |
| `backend/internal/ui/` | Embedded frontend via `//go:embed` | [View](backend/internal/ui/codemap.md) |
| `backend/pkg/config/` | YAML config load/save with env defaults, backup config | [View](backend/pkg/config/codemap.md) |
| `backend/pkg/logger/` | Leveled zerolog facade (stdout + file) | [View](backend/pkg/logger/codemap.md) |
| `backend/pkg/apperror/` | Typed error kinds → HTTP status mapping | [View](backend/pkg/apperror/codemap.md) |
| `backend/docs/` | Auto-generated Swagger 2.0 API spec | [View](backend/docs/codemap.md) |

### Frontend (React/Vite)
| Directory | Responsibility | Map |
|-----------|---------------|-----|
| `web/src/app/` | Page components (React Router routes) — 12 workspaces | [View](web/src/app/codemap.md) |
| `web/src/components/` | Shared UI components (layout, status, terminal, ui) | [View](web/src/components/codemap.md) |
| `web/src/hooks/` | React hooks (polling, WebSocket, stats) | [View](web/src/hooks/codemap.md) |
| `web/src/services/` | HTTP API client + WebSocket factory (8 API namespaces) | [View](web/src/services/codemap.md) |
| `web/src/types/` | Shared TypeScript interfaces (20+ domain models) | [View](web/src/types/codemap.md) |
| `web/src/utils/` | Formatting helpers, cn() utility | [View](web/src/utils/codemap.md) |

### Configuration & Deployment
| Directory | Responsibility | Map |
|-----------|---------------|-----|
| `defaults/` | Default configs — Mihomo YAML, proxy/rule providers | [View](defaults/codemap.md) |
| `deploy/docker/` | Multi-arch Dockerfile + compose files | [View](deploy/docker/codemap.md) |
| `deploy/systemd/` | systemd service unit for Linux deployment | [View](deploy/systemd/codemap.md) |
| `deploy/openwrt/` | OpenWrt SDK packages (core + LuCI) | [View](deploy/openwrt/codemap.md) |
| `scripts/` | Multi-arch build pipeline (13 target platforms) | [View](scripts/codemap.md) |
| `docs/` | Project documentation (architecture, API, frontend, install, roadmap) | [View](docs/codemap.md) |
| `docs/openwrt/` | OpenWrt packaging and integration docs | [View](docs/openwrt/README.md) |

## Data Flow
```
Browser → React SPA (web/) → REST API / WebSocket → Gin Router (backend/)
  → Handler → Service Layer → Mihomo Process / nftables / Filesystem
```

## Architecture Pattern
- **Backend**: Clean architecture with domain interfaces → service implementations → HTTP handlers
- **Frontend**: Page-per-route (React Router) with shared components, custom hooks for data fetching
- **Deployment**: Single Go binary embedding the React SPA, packages for Debian/Arch/OpenWrt

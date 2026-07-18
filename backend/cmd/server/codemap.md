# cmd/server/

## Responsibility
Application entrypoint responsible for bootstrapping the entire Mihombreng backend. Parses CLI flags for config path, loads configuration, initializes logging, wires dependency graph (mihomo service, nftables routing, HTTP router), mounts Swagger docs and embedded SPA static assets onto a Gin HTTP server, and orchestrates graceful shutdown on SIGINT/SIGTERM.

## Design
- **CLI flag parsing**: Uses `flag` package with `-config`/`-c` shorthand, defaulting to `/etc/mihombreng/mihombreng.yaml`. If this path is not accessible and no explicit flag is passed, it automatically falls back to the user config at `~/.config/mihombreng/mihombreng.yaml`.
- **Dependency composition**: Manually constructs service layer — `routing.NewNftablesService()` → `service.NewMihomoService(cfg, configPath, nftablesService)`. No DI framework.
- **Embedded SPA serving**: Uses `ui.GetStaticFS()` to serve a pre-built frontend via `embed.FS`. Serves `index.html` at `/` and as fallback for all non-`/api/` routes (client-side routing support). Static assets served from `/assets/*filepath` and `/favicon.svg`.
- **Graceful shutdown**: OS signal listener (SIGINT/SIGTERM) triggers mihomo process stop if running, then `server.Shutdown` with 5s timeout.
- **Swagger**: Conditionally mounted at `/docs/*any` via `ginSwagger` when `cfg.API.EnableSwagger` is true.

## Flow
1. `flag.Parse()` → extract config path
2. `config.Load(configPath)` → `*Config` (or exit 1)
3. `logger.Init(level, file)` → configure log output (stdout + file)
4. `gin.New()` → app setup, redirect suppression
5. `routing.NewNftablesService()` → nftables abstraction
6. `service.NewMihomoService(cfg, configPath, nftablesService)` → core service
7. `mihomoService.RestoreState()` → recover previous mihomo process state
8. `router.Setup(app, mihomoService, cfg, configPath)` → mount API routes
9. Mount Swagger (conditional) and static assets
10. `server.ListenAndServe()` in goroutine
11. Block on OS signal → stop mihomo → `server.Shutdown(5s)` → exit

## Integration
| Dependency | Direction | Purpose |
|---|---|---|
| `pkg/config` | consumes | Load application + mihomo configuration |
| `pkg/logger` | consumes | Structured logging initialization |
| `internal/http/router` | consumes | API route registration |
| `internal/service` | consumes | `MihomoService` implementation |
| `internal/service/routing` | consumes | `NftablesService` implementation |
| `internal/ui` | consumes | Embedded SPA static files |
| `docs` | consumes | Swagger documentation (blank import) |
| `gin-gonic/gin` | external | HTTP framework |
| `swaggo/gin-swagger` | external | Swagger UI serving |

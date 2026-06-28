# router/

## Responsibility
Central HTTP route registration and wiring for the entire API layer. Instantiates all domain-specific handlers, applies global middleware (logging, recovery, CORS), and maps every endpoint under `/api/v1` to its corresponding handler method using gin route groups.

## Design
- **Composition root pattern**: `Setup()` function receives all injected dependencies (`gin.Engine`, `domain.MihomoService`, `*config.Config`, `configPath`) and constructs handler instances internally.
- **Route groups**: Logical grouping via `api.Group()` for `/backup`, `/backup/remote`, `/converter`, `/dns`, `/mihomo`, `/subscriptions`, and `/app`.
- **Parameter injection via closures**: File-management routes inject a `dir` param (`configs`, `proxy_providers`, `rule_providers`) through anonymous wrapper functions that append `gin.Param` before delegating to `MihomoFilesHandler` methods.
- **Middleware stack**: `gin.Logger()`, `gin.Recovery()`, `middleware.CORS()`, `middleware.RateLimit()` applied globally. `middleware.TokenAuth()` applied to `/api/v1` group.

## Route Tree
```
/api/v1
├── /backup
│   ├── GET  /list
│   ├── POST /create
│   ├── POST /restore
│   ├── POST /restore/:filename
│   ├── DELETE /:filename
│   ├── GET  /status
│   └── POST /retention
├── /backup/remote
│   ├── GET  /list
│   ├── POST /test/:name
│   ├── POST /sync/:name
│   ├── GET  /status/:name
│   └── POST /upload/:name/:filename
├── /converter/parse
├── /dns/lookup
├── /subscriptions
│   ├── GET    /
│   ├── GET    /:id
│   ├── POST   /
│   ├── PUT    /:id
│   ├── DELETE /:id
│   └── POST   /:id/refresh
└── /mihomo
    ├── GET  /status
    ├── POST /start, /stop, /restart
    ├── GET  /logs, /memory, /traffic, /connections
    ├── DELETE /logs
    ├── GET  /core-version, /dashboard-info
    ├── GET  /snapshot/memory, /snapshot/traffic, /snapshot/connections
    ├── GET  /metrics/traffic, /metrics/connections
    ├── DELETE /connections/:id
    ├── GET  /active-config
    ├── POST /validate-config
    ├── Any  /api/*path (Mihomo API proxy)
    └── /configs/**, /proxy-providers/**, /rule-providers/**
```

## Integration
- **Imports all handler packages**: `app`, `backup`, `converter`, `dns`, `mihomo`, `stream`, `subscription`.
- **Depends on**: `domain.MihomoService` interface, `pkg/config.Config`, `middleware.CORS`, `middleware.TokenAuth`, `middleware.RateLimit`.
- **Consumed by**: Application bootstrap (`cmd/` or `main`) which calls `Setup()` to wire the engine.

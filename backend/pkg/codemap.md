# backend/pkg/

## Sub-modules
| Directory | Responsibility | Map |
|-----------|---------------|-----|
| `apperror/` | Typed error system with Kind-based HTTP status mapping for service-to-handler error propagation | [View](apperror/codemap.md) |
| `config/` | YAML configuration loading, persistence, and type definitions for server, mihomo, logging, API, and CORS settings | [View](config/codemap.md) |
| `logger/` | Package-level leveled logging facade wrapping stdlib log with dual stdout/file output | [View](logger/codemap.md) |

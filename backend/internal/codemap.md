# backend/internal/

## Sub-modules
| Directory | Responsibility | Map |
|-----------|---------------|-----|
| `http/` | HTTP layer — Gin router, middleware, and route handlers for all API endpoints | [View](http/codemap.md) |
| `service/` | Mihomo process lifecycle, YAML manipulation, and nftables routing modes (TUN/TProxy/Redirect) | [View](service/codemap.md) |
| `converter/` | Proxy subscription parser — vmess/vless/trojan/ss URI decoding and subscription URL fetching | [View](converter/codemap.md) |
| `domain/` | Pure interface contracts — MihomoService and NftablesService abstractions | [View](domain/codemap.md) |
| `ui/` | Embedded frontend SPA via Go `//go:embed` directive | [View](ui/codemap.md) |

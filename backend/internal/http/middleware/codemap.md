# middleware/

## Responsibility
HTTP middleware components for cross-cutting themes in the gin request pipeline. Provides CORS (Cross-Origin Resource Sharing), token-based API authentication (`Bearer` tokens for REST, `?token` or WebSocket protocols for WS), and IP-based token-bucket rate limiting.

## Design
- **CORS Middleware**: `CORS(cfg *config.CORSConfig) gin.HandlerFunc` handles cross-origin headers, preflight caching, and short-circuiting.
- **Authentication Middleware**: `TokenAuth(expectedToken string) gin.HandlerFunc` enforces Bearer token authentication on all endpoints if configured. Supports WebSocket connections through a `token` URL query parameter or `Sec-WebSocket-Protocol` header.
- **Rate-Limiting Middleware**: `RateLimit(reqsPerSec int) gin.HandlerFunc` implements IP-based rate limiting using a token-bucket algorithm (`golang.org/x/time/rate`). Employs a thread-safe map to track active visitors and periodically prunes inactive visitors using a background cleanup loop.

## Flow

### Token Authentication:
1. Request enters `TokenAuth`.
2. If `expectedToken` is empty, bypass authentication.
3. Check `Authorization` header for `Bearer <token>`.
4. If empty, check `Sec-WebSocket-Protocol` header.
5. If empty, check query parameter `token`.
6. If token matches, continue via `c.Next()`; otherwise, abort with `401 Unauthorized`.

### Rate Limiting:
1. Read Client IP using Gin's `c.ClientIP()`.
2. Retrieve or instantiate a `rate.Limiter` from the visitor map.
3. Check `limiter.Allow()`. If true, proceed; otherwise, return `429 Too Many Requests`.
4. A background goroutine periodically removes rate-limiter maps for visitors idle for >3 minutes.

## Integration
- **Depends on**: `pkg/config.CORSConfig`, `golang.org/x/time/rate`.
- **Used by**: `router.Setup()` which registers the rate limiter globally on the engine and `TokenAuth` on the `/api/v1` group scope.

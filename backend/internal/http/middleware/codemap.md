# middleware/

## Responsibility
HTTP middleware components for cross-cutting concerns in the Gin request pipeline. Provides CORS (Cross-Origin Resource Sharing), token-based API authentication (`Bearer` tokens for REST, `?token` or `Sec-WebSocket-Protocol` headers for WebSockets), and per-IP token-bucket rate limiting.

## Design
- **CORS Middleware** (`cors.go`): `CORS(cfg *config.CORSConfig) gin.HandlerFunc` handles cross-origin headers, allowed origins, methods, exposed headers, preflight caching, and OPTIONS short-circuiting.
- **Authentication Middleware** (`auth.go`): `TokenAuth(expectedToken string) gin.HandlerFunc` enforces Bearer token authentication on all HTTP endpoints if `expectedToken` is non-empty. Supports WebSocket handshake authorization through `Sec-WebSocket-Protocol` header inspection (parsing comma-separated protocol strings) and fallback to `?token` URL query parameter.
- **Rate-Limiting Middleware** (`rate_limit.go`): `RateLimit(reqsPerSec int) gin.HandlerFunc` implements IP-based rate limiting using `golang.org/x/time/rate`. Disables rate limiting if `reqsPerSec <= 0`. Maintains a thread-safe map (`sync.Mutex`) of IP visitor states with limiters and last-seen timestamps, executing inline stale visitor cleanup at most once per minute (pruning visitors idle for >3 minutes).

## Flow

### Token Authentication (`auth.go`):
1. Request enters `TokenAuth`.
2. If `expectedToken` is empty, bypass authentication and invoke `c.Next()`.
3. Check `Authorization` header for `Bearer <token>`.
4. If missing/invalid, check `Sec-WebSocket-Protocol` header for comma-separated tokens matching `expectedToken`.
5. If missing/invalid, check query parameter `token`.
6. If token matches `expectedToken`, call `c.Next()`; otherwise abort request with `401 Unauthorized`.

### Rate Limiting (`rate_limit.go`):
1. If `reqsPerSec <= 0`, bypass rate limiting and call `c.Next()`.
2. Retrieve Client IP via Gin `c.ClientIP()`.
3. Acquire mutex, perform periodic cleanup of visitors idle >3 minutes if last cleanup was >1 minute ago.
4. Retrieve existing visitor `rate.Limiter` or initialize new one with rate limit and burst size equal to `reqsPerSec`.
5. Check `limiter.Allow()`. If true, proceed via `c.Next()`; otherwise, abort request with `429 Too Many Requests`.

## Integration
- **Depends on**: `pkg/config.CORSConfig`, `golang.org/x/time/rate`.
- **Used by**: `router.Setup()` which registers `RateLimit` globally on the Gin engine and `TokenAuth` on the `/api/v1` router group scope.

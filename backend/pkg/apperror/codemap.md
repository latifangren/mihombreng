# pkg/apperror/

## Responsibility
Typed error system that bridges service-layer errors to HTTP status codes. Defines an `AppError` struct carrying a semantic `Kind` classification (internal, not-running, not-configured, timeout), optional wrapped error, and a human message. Provides constructor helpers and a status-code mapper used by HTTP handlers.

## Design
- **Sentinel-like kind enum**: `Kind` is an `int` enum (`KindInternal`, `KindNotRunning`, `KindNotConfigured`, `KindTimeout`). Each maps to a specific HTTP status in `ErrorStatus`.
- **Error wrapping**: `AppError.Err` holds an optional wrapped error. Implements `Unwrap() error` for `errors.As`/`errors.Is` compatibility.
- **Constructor pattern**: `NotRunning(msg)`, `NotConfigured(msg)`, `Timeout(msg)` — return `error` interface, not `*AppError`. `Wrapf(err, kind, format, args...)` wraps existing errors with nil-safety.
- **Status mapping**: `ErrorStatus(err error) int` uses `errors.As` to extract `*AppError` from wrapped chains and maps `Kind` → HTTP status. Defaults to 500 for unmapped errors.

## Flow
```
Service method error
  → Wrapf(err, KindNotRunning, "mihomo not running")
    → returned as error interface
      → HTTP handler calls apperror.ErrorStatus(err)
        → errors.As extracts *AppError
          → Kind switch → 409 Conflict
```

### Kind → HTTP Status Mapping
| Kind | HTTP Status |
|------|-------------|
| `KindNotRunning` | 409 Conflict |
| `KindNotConfigured` | 400 Bad Request |
| `KindTimeout` | 504 Gateway Timeout |
| `KindInternal` | 500 Internal Server Error |
| (unmapped) | 500 Internal Server Error |

## Integration
| Dependency | Direction | Purpose |
|---|---|---|
| `internal/http/*` | consumed by | HTTP handlers use `ErrorStatus` to map errors to responses |
| `internal/service/*` | consumed by | Services return `AppError` via constructors/`Wrapf` |
| stdlib `errors` | uses | `errors.As` for error chain traversal |
| stdlib `net/http` | uses | Status code constants |

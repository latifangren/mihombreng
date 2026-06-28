# internal/domain/

## Responsibility
Domain interface definitions that establish boundaries between the service layer and its consumers (HTTP handlers). Defines the contracts for mihomo core lifecycle management and nftables-based network routing. This package contains zero implementations — it is a pure interface/contract package following the Dependency Inversion Principle.

## Design
- **Interface segregation**: Two focused interfaces rather than one monolith:
  - `MihomoService` — 9 methods covering mihomo process lifecycle (start/stop/restart/status), state persistence, config management, and log access.
  - `NftablesService` — 3 methods for nftables routing setup, cleanup, and TUN status check.
- **Config dependency**: Both interfaces reference `config.MihomoConfig` and `config.RoutingConfig` from `pkg/config`, coupling domain contracts to configuration types.
- **Dependency Inversion**: Handlers import `domain` and depend on interfaces. Implementations live in `internal/service/` and `internal/service/routing/`.

## Flow
No runtime flow — this is a compile-time contract package. The flow is architectural:
```
HTTP Handler → domain.MihomoService (interface)
                      ↓
              service.MihomoService (implementation in internal/service/)

HTTP Handler → domain.NftablesService (interface)
                      ↓
              routing.NftablesService (implementation in internal/service/routing/)
```

## Integration
| Dependency | Direction | Purpose |
|---|---|---|
| `pkg/config` | consumes | `MihomoConfig` and `RoutingConfig` types in interface signatures |
| `internal/service/` | implemented by | `MihomoService` implementation |
| `internal/service/routing/` | implemented by | `NftablesService` implementation |
| `internal/http/router` | consumed by | Handlers typed to these interfaces |

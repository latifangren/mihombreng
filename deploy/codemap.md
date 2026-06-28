# deploy/

## Sub-modules
| Directory | Responsibility | Map |
|-----------|---------------|-----|
| `docker/` | Multi-stage Dockerfile, production and dev compose files, .dockerignore for containerized deployment | [View](docker/codemap.md) |
| `systemd/` | systemd service unit for bare-metal Linux process supervision with auto-restart | [View](systemd/codemap.md) |

## Responsibility
Deployment artifacts and infrastructure-as-code for running Mihombreng across containerized and bare-metal environments. Provides two deployment strategies: Docker (multi-arch, self-contained with bundled Mihomo core and dashboards) and systemd (requires pre-installed binaries and config at standard paths).

## Design
Environment-specific deployment manifests separated by orchestration mechanism. Docker deployment uses a four-stage multi-architecture Dockerfile producing a minimal Alpine image with all dependencies bundled (Mihomo binary, GeoIP databases, dashboard UIs). systemd deployment provides a single service unit file assuming binaries and configs are pre-installed at the FHS-compliant paths defined in `mihombreng.yaml`. Both strategies share the same runtime paths (`/etc/mihombreng/`, `/usr/share/mihombreng/`) and the same config schema.

## Flow
```
Deployment choice
  ├── Docker (recommended)
  │     ├── docker-compose.yml (prod)
  │     │     └── Host networking, read-only config, named log volume
  │     └── docker-compose.dev.yml (dev)
  │           └── Port mapping, bind-mount defaults + local binary
  └── systemd (bare-metal)
        └── mihombreng.service
              └── ExecStart with -c config flag
```

## Integration
- **Config source**: Both strategies consume `defaults/mihombreng.yaml` as application config
- **Binary artifacts**: Docker builds from source; systemd expects pre-built binaries at install paths
- **Shared paths**: `/etc/mihombreng/` (working dir), `/usr/share/mihombreng/` (app binary), `/usr/bin/mihomo` (core)
- **OpenWrt**: Not covered here — uses procd init scripts (documented in `docs/04-installation.md`)

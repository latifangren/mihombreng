# defaults/

## Sub-modules
| Directory/File | Responsibility | Map |
|-----------|---------------|-----|
| `configs/` | Default Mihomo core YAML configuration (ports, DNS, sniffing, proxy groups, rules) | [View](configs/codemap.md) |
| `proxy_providers/` | Placeholder proxy server list file referenced by config.yaml | [View](proxy_providers/codemap.md) |
| `rule_providers/` | Placeholder routing rule payload file for custom rule management | [View](rule_providers/codemap.md) |
| `mihombreng.yaml` | Mihombreng application config (server, mihomo lifecycle, logging, API/CORS settings) | — |

## Responsibility
Default configuration seed directory providing the baseline runtime configuration for both the Mihombreng management server and the underlying Mihomo proxy core. These files are mounted into Docker containers and copied to system paths (`/etc/mihombreng/`) during deployment, establishing the initial working state before user customization.

## Design
Convention-over-configuration directory structure mirroring the Mihomo working directory layout. `mihombreng.yaml` is the application-level config (Go backend + API server), while `configs/`, `proxy_providers/`, and `rule_providers/` contain Mihomo core configs. The `mihombreng.yaml` file defines mihomo binary paths, auto-restart behavior, logging, and API CORS policies. Port bindings align across configs: app server on `:7777`, Mihomo HTTP on `:7890`, external controller on `:9090`.

## Flow
```
Docker/systemd deployment
  └─> Mount defaults/ to /etc/mihombreng/
        ├── mihombreng.yaml -> Go backend reads at startup
        │     ├── server.port: 7777 (Gin HTTP server)
        │     ├── mihomo.core_path: /usr/bin/mihomo
        │     ├── mihomo.config_path: /etc/mihombreng/configs/config.yaml
        │     ├── logging: info level, /var/log/mihombreng.log
        │     └── api.cors: localhost origins, credentials enabled
        └── configs/config.yaml -> Mihomo core reads at startup
              ├── ports: 7890/7891/7892/7893/7894
              ├── dns: 0.0.0.0:1053 (redir-host)
              └── proxy-providers -> proxy_providers/proxy.yaml
```

## Integration
- **Consumer**: Go backend (`cmd/server/main.go`) loads `mihombreng.yaml` via `pkg/config`
- **Consumer**: Mihomo binary loads `configs/config.yaml` as its core config
- **Docker**: `docker-compose.yml` mounts `defaults/mihombreng.yaml` read-only to container
- **Docker dev**: `docker-compose.dev.yml` mounts entire `defaults/` directory for live editing
- **Build script**: `scripts/build.sh` copies `web/dist/` into backend embed path, preserving these defaults
- **API**: All config/provider files are CRUD-manageable through `/api/v1/mihomo/configs/*` endpoints

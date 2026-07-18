# docker/

## Responsibility
Docker containerization for Mihombreng, providing a multi-stage build pipeline that compiles the frontend SPA, builds the Go backend binary, downloads the Mihomo core and third-party dashboard assets, and produces a minimal Alpine-based production image. Includes both production and development compose configurations.

## Design
Four-stage multi-architecture Dockerfile following the build-artifact-narrowing pattern:
- **Stage 1** (`frontend`): Node 20 Alpine — `npm ci` + `npm run build` for the React/Vite SPA
- **Stage 2** (`backend`): Go 1.23 Alpine — downloads Go modules, copies embedded frontend dist, builds a statically-linked binary with `CGO_ENABLED=0` and stripped symbols (`-ldflags="-s -w"`)
- **Stage 3** (`downloader`): Alpine — fetches architecture-specific Mihomo binary (v1.19.29), GeoIP/GeoSite databases (`country.mmdb`, `geoip.dat`, `geosite.dat`, `geoip.metadb`), and three third-party dashboard UIs (zashboard, metacubexd, yacd)
- **Stage 4** (runtime): Alpine — installs `ca-certificates`, `iptables`, `ip6tables`, `iproute2`, `tzdata`; copies all artifacts; exposes ports 7777 (app), 9090 (Mihomo API), 7890 (HTTP proxy), 7891 (redirect), 9091

Two compose files differentiate prod vs dev:
- `docker-compose.yml`: host networking, read-only config mount, named log volume, healthcheck on `/api/app/config`
- `docker-compose.dev.yml`: explicit port mapping, bind-mounts entire `defaults/` and local binary for hot-reload iteration, `LOG_LEVEL=debug`

`.dockerignore` excludes `.git`, docs, scripts, build artifacts, node_modules, and embedded dist from build context.

## Flow
```
docker-compose.yml / docker-compose.dev.yml
  └─> Dockerfile (build context: ../.. = project root)
        ├── Stage 1: node:20-alpine
        │     └── web/ -> npm ci -> npm run build -> /build/web/dist/
        ├── Stage 2: golang:1.23-alpine
        │     └── backend/ + /build/web/dist/ -> go build -> /build/mihombreng
        ├── Stage 3: alpine:latest (downloader)
        │     ├── Mihomo binary (arch-dispatched: amd64/arm64/armv7)
        │     ├── Geo assets (mmdb, dat, metadb) from MetaCubeX/meta-rules-dat
        │     └── UI dashboards (zashboard, metacubexd, yacd)
        └── Stage 4: alpine:latest (runtime)
              ├── /usr/share/mihombreng/mihombreng (app binary)
              ├── /usr/bin/mihomo (core binary)
              ├── /etc/mihombreng/ (geo assets + dashboards)
              └── CMD: mihombreng -c /etc/mihombreng/mihombreng.yaml
```

## Integration
- **Build context**: Project root (`../..` relative to this directory)
- **Config mount**: `defaults/mihombreng.yaml` -> `/etc/mihombreng/mihombreng.yaml` (read-only in prod)
- **Health check**: `wget http://localhost:7777/api/app/config` (30s interval, 10s timeout, 3 retries)
- **Network**: Host networking in prod; explicit port mapping (7777, 9090) in dev
- **Capabilities**: `NET_ADMIN` + `NET_RAW` for iptables/TUN operations
- **Volumes**: Named volume `mihombreng-logs` / `dev-logs` for `/var/log`
- **Architecture**: Supports `linux/amd64`, `linux/arm64`, `linux/armv7` via `TARGETARCH` build arg

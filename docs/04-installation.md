# Installation, Build, Deploy, Redeploy

Mihombreng runs as single Go binary with embedded frontend. Main targets:

- Linux server with `systemd`
- OpenWrt with `procd`
- Docker for containerized deploy

This doc focuses on repeatable build/deploy/redeploy, plus fast troubleshooting when live app does not match source.

## Runtime Layout

### Linux + systemd

```text
App binary:      /usr/share/mihombreng/mihombreng
Service unit:    /usr/lib/systemd/system/mihombreng.service
App config:      /etc/mihombreng/mihombreng.yaml
Mihomo binary:   /usr/bin/mihomo
Mihomo config:   /etc/mihombreng/configs/config.yaml
Web UI:          http://<host>:7777
Mihomo API:      http://<host>:9090
App logs:        journalctl -u mihombreng
```

Important: systemd does **not** start `/usr/bin/mihombreng` in current package layout. It starts:

```ini
ExecStart=/usr/share/mihombreng/mihombreng -c /etc/mihombreng/mihombreng.yaml
```

If you rebuild source but forget to replace `/usr/share/mihombreng/mihombreng`, live service can stay stale.

### OpenWrt + procd

```text
Service:         /etc/init.d/mihombreng
App config:      /etc/mihombreng/mihombreng.yaml
Mihomo config:   /etc/mihombreng/configs/config.yaml
Web UI:          http://<host>:7777
```

## Build Requirements

- Go 1.22+
- Node.js 18+
- `npm`
- `make`
- `swag` for Swagger generation
  - install with `go install github.com/swaggo/swag/cmd/swag@latest`

## Development Build

### Backend build pipeline

Recommended:

```sh
cd backend
make build
```

What it does:

1. builds frontend in `web/`
2. generates Swagger docs in `backend/docs/`
3. copies `web/dist/` into `backend/internal/ui/dist/`
4. builds `backend/bin/mihombreng`

Manual equivalent:

```sh
cd web
npm install
npm run build

cd ../backend
swag init -g cmd/server/main.go -o docs
rm -rf internal/ui/dist
cp -r ../web/dist internal/ui/dist
GIN_MODE=release CGO_ENABLED=0 go build -ldflags="-s -w" -o bin/mihombreng ./cmd/server
```

### Multi-arch release build

```sh
make build-core
```

Outputs release binaries into `backend/bin/` and copies main release artifacts into `core/`.

### Frontend only

```sh
cd web
npm install
npm run build
```

### Live reload

```sh
cd backend
air
```

## Linux Deploy

### Fresh deploy from source

Build on target host:

```sh
cd /path/to/mihombreng/backend
make build
```

Install binary:

```sh
sudo install -m 755 bin/mihombreng /usr/share/mihombreng/mihombreng
```

Restart service:

```sh
sudo systemctl restart mihombreng
sudo systemctl status mihombreng
```

Enable on boot:

```sh
sudo systemctl enable mihombreng
```

### Package-based deploy

Build Debian package:

```sh
make deb-amd64
```

Install package:

```sh
sudo dpkg -i build/mihombreng_<version>-<release>_amd64.deb
```

The package installs:

- app binary to `/usr/share/mihombreng/mihombreng`
- Mihomo core to `/usr/bin/mihomo`
- config and assets to `/etc/mihombreng/`
- service unit to `/usr/lib/systemd/system/mihombreng.service`

## Linux Redeploy

Use this when source changed and service already exists.

### Safe redeploy checklist

1. confirm branch/commit
2. rebuild app
3. replace installed binary
4. restart service
5. verify live endpoints

### Commands

```sh
cd /home/<user>/GITHUB/mihombreng/backend
make build
sudo install -m 755 bin/mihombreng /usr/share/mihombreng/mihombreng
sudo systemctl restart mihombreng
sudo systemctl is-active mihombreng
```

### Post-redeploy verification

```sh
curl -i http://127.0.0.1:7777/api/v1/mihomo/api/version
curl http://127.0.0.1:7777/api/v1/mihomo/status
curl http://127.0.0.1:7777/api/v1/mihomo/snapshot/memory
curl http://127.0.0.1:7777/api/v1/mihomo/snapshot/traffic
curl http://127.0.0.1:7777/api/v1/mihomo/snapshot/connections
```

Expected signs:

- `api/version` returns `200 OK`
- `status.running` is `true`
- `memory` is non-zero while core active
- `traffic` changes under real traffic
- `connections.total` rises when live connections exist

### When frontend changed too

No separate frontend deploy step is needed if you use `make build`. Frontend assets are embedded into Go binary during build.

## OpenWrt Deploy

### Service control

```sh
/etc/init.d/mihombreng start
/etc/init.d/mihombreng stop
/etc/init.d/mihombreng restart
/etc/init.d/mihombreng enable
```

### Package install

OpenWrt 24.10 uses `.ipk` packages via `opkg`.

```sh
scp mihombreng_*.ipk root@openwrt:/tmp/
ssh root@openwrt "opkg install /tmp/mihombreng_*.ipk"
```

OpenWrt 25.12 uses `.apk` packages via `apk`.

```sh
scp mihombreng-*.apk root@openwrt:/tmp/
ssh root@openwrt "apk add /tmp/mihombreng-*.apk"
```

Note: dev/PR CI smoke builds use placeholder runtime assets for faster validation. Use full-build artifacts from `master` or manual dispatch for real deployment payloads.

## Docker Deploy

Docker flow lives in `deploy/docker/`.

Typical production build:

```sh
docker build -f deploy/docker/Dockerfile -t mihombreng:latest .
```

Typical run path:

- runtime image contains `/usr/share/mihombreng/mihombreng`
- Mihomo binary at `/usr/bin/mihomo`
- config under `/etc/mihombreng/`

## Configuration

Main app config: `/etc/mihombreng/mihombreng.yaml`

Example:

```yaml
version: "1.0.0"
environment: production
server:
  port: "7777"
  host: 0.0.0.0
  mode: release
mihomo:
  core_path: /usr/bin/mihomo
  config_path: /etc/mihombreng/configs/config.yaml
  working_dir: /etc/mihombreng
  auto_restart: true
  auto_start: true
  log_file: /var/log/mihomo.log
  routing:
    tcp: tun
    udp: tun
    tun_device: ""
logging:
  level: info
  file: /var/log/mihombreng.log
api:
  rate_limit: 100
  timeout: 30
  enable_swagger: true
  auth_token: ""   # API authentication token (empty to disable)
  cors:
    enabled: true
    allowed_origins: []
```

Mihomo controller settings (local external controller on 127.0.0.1 for zero-exposure security):

```yaml
external-controller: 127.0.0.1:9090
secret: "mihombreng"
```

App-side API connection matches that local controller config (routed secure proxy):

```yaml
mihomo:
  api_url: http://127.0.0.1:9090
  api_secret: mihombreng
```

Note: By binding Mihomo's `external-controller` to `127.0.0.1`, you completely isolate it from external networks, routing all requests securely through Mihombreng's API Reverse Proxy.

### Warning: Dashboard UI Updates
If you use the built-in "Update" or "Upgrade" buttons inside external dashboard panels (like MetaCubeXD, Yacd, Zashboard) that trigger API upgrades via the Mihomo core process:
* **Risk**: The Mihomo upgrade API unzips the new dashboard directly into `/etc/mihombreng/ui/`, which **overwrites and deletes the other dashboards** under that directory (rendering it flat).
* **Prevention**: It is recommended to perform dashboard updates manually by extracting zip files into their respective subdirectories (e.g. `/etc/mihombreng/ui/metacubexd`) or change the `external-ui` value in `/etc/mihombreng/configs/config.yaml` to point directly to a specific subdirectory (e.g. `ui/metacubexd`) before updating, so it only extracts inside that subfolder.

## Operations

### Service status

```sh
systemctl status mihombreng
systemctl is-active mihombreng
journalctl -u mihombreng -n 100 --no-pager
journalctl -u mihombreng -f
```

### Process and port checks

```sh
ps aux | grep mihombreng
ss -ltnp | grep 7777
ss -ltnp | grep 9090
```

### Version checks

```sh
curl http://127.0.0.1:7777/api/v1/mihomo/core-version
curl -H "Authorization: Bearer <secret>" http://127.0.0.1:9090/version
```

## Troubleshooting

## 1. Source updated, but live app still behaves old

Symptoms:

- code looks fixed in repo
- browser still shows old behavior
- live API responses do not match source

Check:

```sh
systemctl cat mihombreng
ls -l /usr/share/mihombreng/mihombreng
readlink -f /proc/$(pgrep -f '/usr/share/mihombreng/mihombreng' | head -n 1)/exe
```

Most common cause:

- you rebuilt inside repo
- but did **not** replace `/usr/share/mihombreng/mihombreng`

Fix:

```sh
cd /path/to/mihombreng/backend
make build
sudo install -m 755 bin/mihombreng /usr/share/mihombreng/mihombreng
sudo systemctl restart mihombreng
```

## 2. `/api/v1/mihomo/api/version` returns `401 Unauthorized`

Check direct Mihomo API first:

```sh
curl -i -H "Authorization: Bearer <secret>" http://127.0.0.1:9090/version
```

If direct Mihomo request works but app endpoint returns `401`, likely causes:

- app service still stale
- wrong app config `mihomo.api_secret`
- app config changed but service not restarted

Check:

```sh
grep -n "api_secret\|api_url" /etc/mihombreng/mihombreng.yaml
grep -n "external-controller\|secret" /etc/mihombreng/configs/config.yaml
systemctl restart mihombreng
```

## 3. Dashboard uptime works, but memory/traffic/connections are zero

This usually means app is up, but live Mihomo snapshot/API fetch is failing or parsed data is empty.

Check app endpoints:

```sh
curl http://127.0.0.1:7777/api/v1/mihomo/snapshot/memory
curl http://127.0.0.1:7777/api/v1/mihomo/snapshot/traffic
curl http://127.0.0.1:7777/api/v1/mihomo/snapshot/connections
```

Check direct Mihomo endpoints:

```sh
curl -H "Authorization: Bearer <secret>" http://127.0.0.1:9090/memory
curl -H "Authorization: Bearer <secret>" http://127.0.0.1:9090/traffic
curl -H "Authorization: Bearer <secret>" http://127.0.0.1:9090/connections
```

If direct endpoints return real data but app snapshot endpoints return zero:

- redeploy app binary again
- confirm running binary path
- check service logs with `journalctl -u mihombreng -n 200 --no-pager`

## 4. Logs page empty

Check live Mihomo core log stream:

```sh
curl -H "Authorization: Bearer <secret>" http://127.0.0.1:9090/logs
```

If stream is active but UI still empty:

- verify app WebSocket endpoint is reachable
- verify reverse proxy is not stripping WebSocket upgrade
- check browser devtools WS frames
- check `journalctl -u mihombreng -f`

If direct Mihomo `/logs` is empty too, issue is in core/log generation, not frontend.

## 5. Build fails in `web` stage

Common causes:

- TypeScript error
- unused imports/vars when strict flags active
- missing `npm install`

Check:

```sh
cd web
npm install
npm run build
```

Then retry:

```sh
cd ../backend
make build
```

## 6. Service restarts, but browser still stale

Possible causes:

- browser cached old JS bundle
- reverse proxy serving old content
- service restarted from wrong unit or wrong host

Check:

```sh
curl http://127.0.0.1:7777/
systemctl status mihombreng
hostname
```

Then force-refresh browser.

## 7. Need fast triage sequence

Run in this order:

```sh
systemctl is-active mihombreng
curl -i http://127.0.0.1:7777/api/v1/mihomo/api/version
curl http://127.0.0.1:7777/api/v1/mihomo/status
curl -H "Authorization: Bearer <secret>" http://127.0.0.1:9090/version
journalctl -u mihombreng -n 100 --no-pager
```

That usually separates:

- app dead
- app alive but stale
- app alive but wrong config
- Mihomo API auth mismatch
- frontend-only issue

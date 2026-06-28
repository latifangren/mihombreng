# Mihombreng

Controller and manager for Mihomo (Clash Meta) on OpenWrt and Linux servers.

## Features

- Core management — start/stop/restart Mihomo with API control
- Routing modes — TUN, TProxy, Redirect, Mixed
- Web dashboard — React SPA with retro-brutalist theme
- Config editor — edit Mihomo config.yaml from browser
- File manager — manage providers, rules, GeoIP/GeoSite databases
- Backup & restore — snapshot and restore Mihomo state
- DNS lookup — query any DNS server from the UI
- Subscription converter — parse proxy subscription URLs
- Log streaming — real-time WebSocket log viewer
- OpenWrt integration — procd service, nftables, LuCI app

## Quick Start

### Local build

```sh
cd backend
make build
```

Output:

- embedded binary at `backend/bin/mihombreng`

### Local run

```sh
cd backend
./bin/mihombreng -c ../defaults/mihombreng.yaml
# Open http://localhost:7777
```

### Linux redeploy

```sh
cd /home/<user>/GITHUB/mihombreng/backend
make build
sudo install -m 755 bin/mihombreng /usr/share/mihombreng/mihombreng
sudo systemctl restart mihombreng
```

Verify:

```sh
curl -i http://127.0.0.1:7777/api/v1/mihomo/api/version
curl http://127.0.0.1:7777/api/v1/mihomo/status
```

### OpenWrt

```sh
scp mihombreng_*.ipk root@openwrt:/tmp/
ssh root@openwrt "opkg install /tmp/mihombreng_*.ipk"
```

For full deploy, redeploy, and troubleshooting guide see [docs/04-installation.md](docs/04-installation.md).

## Project Structure

```text
mihombreng/
├── backend/                  Go backend (Gin)
│   ├── cmd/server/           Entry point
│   ├── internal/
│   │   ├── http/
│   │   │   ├── handler/     Route handlers
│   │   │   ├── middleware/   CORS, auth
│   │   │   └── router/      Route definitions
│   │   ├── service/          Mihomo lifecycle, nftables
│   │   ├── domain/           Service interfaces
│   │   ├── converter/        Proxy URL parser
│   │   └── ui/               Embedded frontend
│   └── pkg/
│       ├── config/           YAML config
│       └── logger/           Zerolog setup
├── web/                      React + Vite + Tailwind
│   ├── src/
│   │   ├── app/              Pages (React Router)
│   │   ├── components/       UI components
│   │   ├── hooks/            API hooks
│   │   ├── services/         HTTP client, WebSocket
│   │   └── utils/            Helpers
│   └── dist/                 Production build (embedded)
├── defaults/                 Default config files
├── deploy/
│   ├── docker/               Dockerfile, compose
│   └── systemd/              Systemd unit
├── docs/                     Architecture, API, roadmap
├── scripts/                  Build scripts
└── Makefile                  Build targets
```

## Documentation

- [Architecture](docs/01-architecture.md)
- [API Reference](docs/02-api-reference.md)
- [Frontend](docs/03-frontend.md)
- [Installation & Deployment](docs/04-installation.md)
- [Roadmap](docs/05-roadmap.md)

## Tech Stack

| Layer | Choice |
|---|---|
| Backend | Go, Gin, zerolog, go-yaml |
| Frontend | React 19, Vite 7, TypeScript, Tailwind CSS v4 |
| Core | Mihomo (Clash Meta) |
| Platform | OpenWrt (procd, nftables), Linux (systemd) |

## License

MIT

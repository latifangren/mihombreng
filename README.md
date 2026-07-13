# Mihombreng

A lightweight, high-performance controller and dashboard for the **Mihomo (Clash Meta)** proxy core on OpenWrt and Linux servers. It features a Go backend API with an embedded React WebUI served as a single compiled binary.

## Features

- **Core Lifecycle Management**: Start, stop, and restart the Mihomo core process programmatically with real-time status.
- **Routing Modes**: Seamless orchestration for transparent proxying (TUN, TProxy, Redirect, and Mixed packet interception).
- **Diagnostics & Self-Healing**: Check host paths, filesystem permissions, DNS resolution, and TCP reachability. Triggers automated recovery routines (DNS resolver configuration reset, firewall flush, daemon restart) directly from the WebUI.
- **Real-Time Observability**:
  - Live activity logging stream with terminal pauses, filter queries, and TXT/CSV/JSON export formats.
  - Interactive retro-brutalist bandwidth graphs (download/upload speed) using lightweight custom SVG lines with timeline zoom scales (1m, 2m, 5m) and rendering pause controls.
  - Live connections inspector with detailed routing paths, DNS resolutions, and individual flow termination controls.
- **Config Editor**: Edit Mihomo rule setups from your browser using Monaco Editor, featuring debounced YAML inline linting (squigglies), syntax validation gates, and side-by-side Monaco DiffEditor comparison previews before saving.
- **Provider & Subscription Management**:
  - Auto-scheduler: Background task runner that periodically updates and pulls profile subscriptions (daily, weekly, etc.) automatically.
  - File inspector: Detailed sync tracking with error indicator badges, sync error panels, and manual validation sync updates.
- **Backup & Restore**: Snapshot local configurations and restore history states from local disk or remote WebDAV cloud sync stores.
- **Hardened Security**: Mandatory token-based API authentication (Bearer tokens and WebSocket subprotocols) and per-IP request rate limiting.
- **Package Integration**: Native packaging scripts for Linux `systemd` and OpenWrt SDK (`procd` and LuCI package outputs).

## Screenshots

### Dashboard
![Dashboard](docs/images/dashboard.png)

### Mihomo Core Status & Logs
![Mihomo Core Status & Logs](docs/images/mihomo.png)

### Settings & Backups
![Settings & Backups](docs/images/settings.png)

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
│   │   │   ├── handler/      Route handlers
│   │   │   ├── middleware/   CORS, auth, rate limit
│   │   │   └── router/       Route definitions
│   │   ├── service/          Mihomo lifecycle, nftables, backup
│   │   ├── domain/           Service interfaces
│   │   ├── converter/        Proxy subscription parser
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

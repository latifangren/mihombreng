# OpenWrt Support

OpenWrt packaging and integration documentation for mihombreng.

## Overview

This directory contains the complete plan for OpenWrt support, including:

- **Architecture**: Package structure and component relationships
- **Build System**: SDK Makefile design and build scripts
- **LuCI Integration**: Web UI integration with OpenWrt's LuCI framework
- **CI/CD**: Automated package building for multiple architectures

## Quick Start

```bash
# Build for OpenWrt
make openwrt-build ARCH=aarch64

# Install on OpenWrt 24.10
opkg install mihombreng_*.ipk
opkg install luci-app-mihombreng_*.ipk
```

## Current CI Model

- `dev` / PR: smoke build only (`x86_64 + openwrt-24.10`)
- `master` / manual dispatch: full multi-arch matrix
- smoke build uses placeholder runtime assets for speed
- full build downloads real runtime assets

## Documentation Map

| Document | Purpose |
|----------|---------|
| [01-architecture.md](01-architecture.md) | System architecture and component design |
| [02-breakdown-plan.md](02-breakdown-plan.md) | Implementation milestones and issues |
| [03-build-system.md](03-build-system.md) | Build system design and scripts |
| [04-package-structure.md](04-package-structure.md) | Package file structure and contents |
| [05-ci-cd.md](05-ci-cd.md) | CI/CD workflow for automated builds |
| [06-luci-integration.md](06-luci-integration.md) | LuCI app design and JS views |
| [07-installation.md](07-installation.md) | Installation and deployment guide on OpenWrt routers |

## Architecture Summary

```
deploy/openwrt/
├── mihombreng/                    # Core package
│   └── Makefile                   # SDK build (Go + Mihomo + assets)
├── luci-app-mihombreng/           # LuCI package
│   ├── Makefile                   # LuCI metadata
│   └── root/                      # LuCI files
│       ├── etc/init.d/mihombreng  # procd service
│       ├── usr/share/luci/menu.d/ # Menu entries
│       ├── usr/share/rpcd/acl.d/  # ACL permissions
│       └── www/luci-static/resources/view/mihombreng/
│           ├── dashboard.js       # iframe dashboard
│           └── server.js          # server controls
scripts/
└── build-openwrt.sh               # Local helper build entrypoint; SDK package logic now lives in Makefiles
```

## Key Design Decisions

1. **Local feed source copy**: SDK build copies source from mounted `/feed` workspace instead of cloning GitHub
2. **Fast smoke CI**: dev and PR builds validate package logic with placeholders for heavy runtime assets
3. **Separate concerns**: Core package (Go + Mihomo) vs LuCI package (web UI)
4. **Full build remains release path**: master/manual builds still fetch real runtime payloads

## Target Platforms

| Architecture | Mihomo Arch | OpenWrt Arch |
|--------------|-------------|--------------|
| x86_64 | amd64 | x86_64 |
| aarch64 | arm64 | aarch64_generic |
| armv7 | armv7 | arm_cortex-a7 |
| mips | mips-softfloat | mips_24kc |

## Dependencies

### Core Package (`mihombreng`)
- `ca-bundle` — HTTPS support
- `ip-full` — IP routing
- `kmod-tun` — TUN device support
- `kmod-nft-core` — nftables core
- `kmod-nft-nat` — NAT rules
- `kmod-nft-tproxy` — TPROXY rules
- `kmod-nft-socket` — Socket matching

### LuCI Package (`luci-app-mihombreng`)
- `mihombreng` — core package
- `luci-base` — LuCI framework
- `rpcd` — ubus RPC daemon

## Related Documentation

- [Linux Server Deployment](../04-installation.md) — Debian/Ubuntu/Arch packages
- [Docker Deployment](../../deploy/docker/) — Container deployment
- [Systemd Service](../../deploy/systemd/) — Linux service unit

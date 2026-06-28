# Build System

Build system design for OpenWrt packages.

## Design Philosophy

Current implementation is no longer "thin SDK Makefiles + heavy external build script".

Current reality:

- SDK Makefiles contain real build logic
- source is copied from mounted CI workspace (`/feed/...`)
- frontend is built inside SDK package build with `npm ci`
- Swagger docs are treated as pre-generated tracked artifacts
- smoke CI can skip heavy runtime asset downloads with placeholders

This design favors CI portability and removes the need to clone source during SDK builds.

## Current Build Flow

```
make openwrt-build ARCH=aarch64
      │
      ▼
GitHub Actions or local OpenWrt build flow
      │
      ├── Prepare local feed layout
      │     ├── mihombreng/Makefile
      │     ├── defaults/*
      │     └── luci-app-mihombreng/root/*
      │
      ├── openwrt/gh-action-sdk@v11 mounts repo as /feed
      │
      ├── Build/Prepare copies source from:
      │     ├── /feed/web
      │     ├── /feed/backend
      │     └── /feed/defaults
      │
      ├── Build/Compile
      │     ├── npm ci && npm run build
      │     ├── copy web/dist into backend/internal/ui/dist
      │     ├── use pre-generated backend/docs/*
      │     ├── cross-compile Go binary
      │     └── fetch or synthesize runtime assets
      │
      └── Package/install assembles final package
```

## Core Package Design

### `deploy/openwrt/mihombreng/Makefile`

Key points in current Makefile:

- no `PKG_SOURCE_URL` clone from GitHub
- `Build/Prepare` copies source from mounted `/feed`
- frontend build uses `npm ci`
- Swagger docs are **not** regenerated in package build
- `SMOKE_BUILD=1` switches heavy runtime assets to placeholders

### Source Preparation

```makefile
define Build/Prepare
	cp -a /feed/web $(PKG_BUILD_DIR)/web
	cp -a /feed/backend $(PKG_BUILD_DIR)/backend
	mkdir -p $(PKG_BUILD_DIR)/files
	cp -a /feed/defaults/* $(PKG_BUILD_DIR)/files/
endef
```

Why this matters:

- works for private or public repos
- avoids SDK-time GitHub auth issues
- guarantees build uses checked-out commit exactly

### Compile Phase

Current compile stage does:

1. Build frontend with `npm ci && npm run build`
2. Copy SPA into `backend/internal/ui/dist`
3. Use pre-generated Swagger docs already in `backend/docs/`
4. Cross-compile `backend/cmd/server`
5. Either:
   - download real runtime assets for full build
   - or generate placeholders for smoke build

### Smoke Build Mode

Smoke build is enabled via environment variable:

```makefile
SMOKE_BUILD=1
```

When enabled, package build skips real downloads for:

- Mihomo binary
- `country.mmdb`
- `geoip.dat`
- `geosite.dat`
- `geoip.metadb`
- Zashboard UI bundle
- MetaCubeXD UI bundle

Instead it creates lightweight placeholders so package assembly still validates.

This is meant for:

- fast dev CI
- PR validation
- package rule sanity checks

It is **not** meant as release-quality payload validation.

### Full Build Mode

Full build keeps real downloads for all runtime assets.

This is the production-faithful path used on:

- `master`
- manual `workflow_dispatch`

## LuCI Package Design

### `deploy/openwrt/luci-app-mihombreng/Makefile`

LuCI package remains simple:

- init script install
- menu JSON install
- ACL JSON install
- LuCI JS view install

No heavy compile step is required there.

## Local Build Commands

```bash
make openwrt-build ARCH=aarch64
make openwrt-clean
```

`ARCH=` is required.

Examples of current OpenWrt SDK arch names:

- `x86_64`
- `aarch64_generic`
- `arm_cortex-a7`
- `mips_24kc`

## Current Architecture Mapping

| OpenWrt Arch | Go Arch | Mihomo Arch |
|--------------|---------|-------------|
| x86_64 | amd64 | amd64 |
| aarch64_generic | arm64 | arm64 |
| arm_cortex-a7 | arm | armv7 |
| mips_24kc | mips | mips-softfloat |

## Dependencies

### Host / SDK Tools

- `node` / `npm` — frontend build
- `golang` — Go cross-compilation
- `wget` / `curl` — runtime asset downloads in full build
- `unzip` / `tar` — archive extraction in full build

### Not used anymore in package build

- `swag` installation at build time
- `go mod tidy` during package build
- GitHub source cloning during package build

## CI Optimizations Already Applied

Current workflow-side optimizations:

- dev/PR smoke build split from full matrix
- Node cache via `web/package-lock.json`
- Go cache via `backend/go.sum`
- `npm ci` instead of `npm install`
- pre-generated Swagger docs
- smoke-mode placeholders for heavy assets

## Runtime Asset Strategy

### Full Build

Downloads real:

- Mihomo
- GeoIP / Geosite assets
- Zashboard
- MetaCubeXD

### Smoke Build

Creates placeholders for those assets.

Tradeoff:

- much faster CI
- lower runtime fidelity
- still validates package structure and install rules

## Troubleshooting

### Common Issues

1. **Source copy fails**: verify `/feed/web`, `/feed/backend`, `/feed/defaults` exist in mounted workspace
2. **Frontend build fails**: inspect `npm ci` output inside SDK step
3. **Go cross-build fails**: verify target `GOARCH`, `GOARM`, `GOMIPS` mapping
4. **Smoke package install phase fails**: ensure placeholder files still satisfy `Package/install`
5. **Full build asset download fails**: check external release URLs and network access

### Debug Tips

- Smoke build proves package logic, not release payload quality
- Full build remains final validation path
- If local test is needed, reproduce with `ARCH=<arch>` and inspect generated `$(PKG_BUILD_DIR)` contents

## Notes on Historical Docs

Some older planning docs still reference:

- `scripts/build-openwrt.sh` as main package build engine
- `PKG_SOURCE_URL` GitHub cloning
- runtime Swagger regeneration

Those describe earlier design intent, not current implementation.

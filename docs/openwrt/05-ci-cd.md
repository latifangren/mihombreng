# CI/CD

CI/CD workflow for automated OpenWrt package building.

## Overview

GitHub Actions builds OpenWrt packages in two modes:

- **Smoke build** for fast feedback on `dev` and pull requests
- **Full build** for complete package validation on `master` and manual runs

This split keeps daily development faster while preserving full multi-arch validation before release.

## Workflow Design

### Triggers

| Trigger | Condition | Purpose |
|---------|-----------|---------|
| `workflow_dispatch` | Manual | Run full matrix on demand |
| `push` | Branches: `dev`, `master`; paths: `deploy/openwrt/**`, `scripts/build-openwrt.sh`, `backend/**`, `web/**`, `defaults/**` | Build on packaging or app changes |
| `pull_request` | Base branches: `dev`, `master`; same paths as push | Validate PR changes with smoke build |

## Job Split

### Smoke Build

Runs when:

- push to `dev`
- pull request targeting `dev` or `master`

Target:

- `x86_64`
- `openwrt-24.10`

Purpose:

- Validate feed structure
- Validate SDK package rules
- Validate frontend build and Go build
- Validate package assembly quickly

Smoke build sets `SMOKE_BUILD=1` and uses lightweight placeholders instead of downloading the real:

- Mihomo binary
- GeoIP / Geosite assets
- Zashboard UI bundle
- MetaCubeXD UI bundle

This keeps dev CI faster while still proving package logic works.

### Full Build

Runs when:

- push to `master`
- manual `workflow_dispatch`

Targets:

- `x86_64`
- `aarch64_generic`
- `arm_cortex-a7`
- `mips_24kc`

Across:

- `openwrt-24.10`
- `openwrt-25.12`

Full build downloads real runtime assets and remains production-faithful.

**Total combinations**: 4 architectures × 2 branches = 8 builds

## Current Workflow Shape

```yaml
name: Build OpenWrt Packages

on:
  workflow_dispatch:
  push:
    branches: [dev, master]
    paths:
      - 'deploy/openwrt/**'
      - 'scripts/build-openwrt.sh'
      - 'backend/**'
      - 'web/**'
      - 'defaults/**'
  pull_request:
    branches: [dev, master]
    paths:
      - 'deploy/openwrt/**'
      - 'scripts/build-openwrt.sh'
      - 'backend/**'
      - 'web/**'
      - 'defaults/**'

jobs:
  smoke_build:
    if: github.event_name == 'pull_request' || github.ref == 'refs/heads/dev'
    strategy:
      matrix:
        arch: [x86_64]
        branch: [openwrt-24.10]

  full_build:
    if: github.event_name == 'workflow_dispatch' || github.ref == 'refs/heads/master'
    strategy:
      matrix:
        arch: [x86_64, aarch64_generic, arm_cortex-a7, mips_24kc]
        branch: [openwrt-24.10, openwrt-25.12]
```

## Feed Structure Pattern

The workflow uses `openwrt/gh-action-sdk@v11`.

Important detail: the action mounts the repository workspace as `/feed`, so the workflow first prepares a local feed layout:

```yaml
- name: Setup Feed Structure
  run: |
    mkdir -p mihombreng luci-app-mihombreng
    cp -f deploy/openwrt/mihombreng/Makefile mihombreng/
    cp -rf defaults/* mihombreng/
    cp -f deploy/openwrt/luci-app-mihombreng/Makefile luci-app-mihombreng/
    cp -rf deploy/openwrt/luci-app-mihombreng/root luci-app-mihombreng/
```

The core package then copies source directly from mounted workspace paths like:

- `/feed/web`
- `/feed/backend`
- `/feed/defaults`

This avoids cloning source from GitHub during SDK builds.

## Tooling and Caches

Before SDK build, workflow sets up host caches:

```yaml
- name: Setup Node
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
    cache-dependency-path: web/package-lock.json

- name: Setup Go
  uses: actions/setup-go@v5
  with:
    go-version: '1.24'
    cache-dependency-path: backend/go.sum
```

Notes:

- frontend build uses `npm ci`
- OpenWrt package build uses pre-generated Swagger docs already tracked in `backend/docs/`
- smoke build skips heavy external downloads

## OpenWrt SDK Action

```yaml
- name: Build Packages
  uses: openwrt/gh-action-sdk@v11
  env:
    ARCH: ${{ matrix.arch }}-${{ matrix.branch }}
    FEEDNAME: mihombreng
    PACKAGES: mihombreng luci-app-mihombreng
    NO_SHFMT_CHECK: 1
```

Full build additionally passes:

```yaml
KEY_BUILD: ${{ secrets.SIGNING_KEY_SEC }}
```

Smoke build does **not** use signing.

## Package Format by Branch

### OpenWrt 24.10

- Format: `.ipk`
- Package manager: `opkg`

### OpenWrt 25.12

- Format: `.apk`
- Package manager: `apk`

Workflow artifact collection branches on this difference.

## Artifact Naming

### Smoke Build Artifacts

- `openwrt-smoke-x86_64-openwrt-24.10`

Retention:

- 14 days

### Full Build Artifacts

Examples:

- `openwrt-full-x86_64-openwrt-24.10`
- `openwrt-full-aarch64_generic-openwrt-25.12`

Retention:

- 30 days

## Manual Build

### Local Build

```bash
make openwrt-build ARCH=aarch64
make openwrt-clean
```

`ARCH=` is required.

### Manual Full CI Run

```bash
gh workflow run build-openwrt.yml
```

`workflow_dispatch` runs the full build path.

## Installation on OpenWrt

### OpenWrt 24.10

```bash
scp output/*.ipk root@openwrt:/tmp/
ssh root@openwrt
cd /tmp
opkg install mihombreng_*.ipk
opkg install luci-app-mihombreng_*.ipk
/etc/init.d/mihombreng enable
/etc/init.d/mihombreng start
```

### OpenWrt 25.12

```bash
scp output/*.apk root@openwrt:/tmp/
ssh root@openwrt
cd /tmp
apk add mihombreng-*.apk
apk add luci-app-mihombreng-*.apk
/etc/init.d/mihombreng enable
/etc/init.d/mihombreng start
```

## Troubleshooting

### Common Issues

1. **SDK setup fails**: Verify `ARCH` matches OpenWrt SDK naming (`aarch64_generic`, `arm_cortex-a7`, `mips_24kc`)
2. **Package source missing**: Verify feed structure copy step ran before SDK build
3. **Package install step fails**: Check required placeholder/real assets exist under `$(PKG_BUILD_DIR)`
4. **Full build downloads fail**: Check external asset URLs and network access
5. **Artifact upload empty**: Check whether branch expects `.ipk` or `.apk`

### Debug Notes

- Smoke build is intentionally not production-faithful for runtime assets
- Full build is the source of truth for release-quality payloads
- For SDK internals, inspect the `Build Packages` step from `openwrt/gh-action-sdk@v11`

## Future Improvements

1. Pin external asset versions beyond Mihomo for better cacheability
2. Add optional changed-files gating for frontend rebuilds
3. Add package installation test on real OpenWrt target
4. Add release automation for package publishing

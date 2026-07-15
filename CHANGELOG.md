# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.3] - 2026-07-15

### Added
- **Read-Only Markdown Files Support**: Implemented read-only rendering mode for Markdown (`.md`) documentation files in the Config Editor and File Manager to prevent users from breaking system documents. This adds special badges, skips Monaco text editor edits, and locks action gates.

### Changed
- **Official GeoIP/Geosite Repositories**: Replaced outdated `rtaserver/meta-rules-dat` download URLs with the official `MetaCubeX/meta-rules-dat` repository across Makefiles and Docker configurations.
- **Unified Config Template**: Consolidated three redundant default config files in package bundles into a single, clean `config.yaml` using optimal Fake-IP, TUN, and Sniffer rules from the official metadata.

### Fixed
- **Backend Documentation Access**: Updated backend file handlers to allow reading and downloading `.md` files without throwing YAML extension enforcement errors.

## [1.2.2] - 2026-07-14

### Fixed
- **Mihomo Config Key Compatibility**: Reverted config keys `proxy-provider` and `rule-provider` back to their mandatory plural forms (`proxy-providers` and `rule-providers`) in all default configuration templates to prevent Mihomo core startup crashes, while maintaining singular URL paths for API consistency.

## [1.2.1] - 2026-07-14

### Added
- **CI Auto-Release Workflow**: Implemented automated release process via GitHub Actions triggered by pushing tags or manual workflow dispatches.
- **Dynamic Package Versioning**: Overhauled Makefiles to extract package versions and releases dynamically from defaults configuration file.

### Fixed
- **Modal Input Focus Loss**: Resolved focus loss on keypress in modal inputs across the application (e.g. create/rename modals) by refactoring hook dependencies.
- **WebSocket Streaming Goroutine Leaks**: Prevented websocket resource leaks by handling client disconnection signals to cleanly shutdown ticker loops and HTTP reader streams in logs, connections, and system log file tailing.
- **MihomoService Concurrency & Data Race**: Locked access with RWMutex to start/stop processes and verify outbound routing status, resolving background data races and concurrent goroutines accumulation.
- **Goroutine-free IP Rate Limiter**: Overhauled rate limiting middleware to clean stale visitor allocations dynamically inline, removing background goroutines leaks entirely.

### Changed
- **Singular Endpoint Paths Uniformity**: Standardized API paths and React components from plural (`proxy-providers` / `rule-providers`) to singular (`proxy-provider` / `rule-provider`) for uniform REST design.

## [1.2.0] - 2026-06-28

### Added
- **Monaco Editor Inline YAML Linting**: Integrated backend error offset parsing with Monaco Editor's model markers to display real-time, on-the-fly syntax validation errors (squigglies) and jump navigation warnings in the config editor workspace.
- **Diagnostics Self-Healing Recovery Actions**: Implemented backend-driven recovery targets accessible through direct WebUI action buttons to execute specific self-healing commands (restarting `mihomo`/`go` controller daemon, resetting DNS server, flushing/reloading `iptables`/`nftables` packet filters).
- **Transactional Routing Orchestration**: Integrated transactional routing status control gates, a pre-flight `/routing/validate` API validation endpoint, post-failure rollbacks, and sequential startup/shutdown Rule cleaning routines.
- **Retro Bandwidth Velocity Charts**: Developed a high-performance bandwidth metrics tracker featuring a sliding window buffer, Pause rendering controls, timeline zoom scopes (1m, 2m, 5m), and light custom SVG speed graphs.
- **Automated Profile Subscription Scheduler**: Added a background worker daemon in Go to periodically fetch and update profile subscriptions automatically on configurable interval ticks (daily, weekly, etc.).
- **Provider Sync Inspector**: Implemented validation error feedback badges and manual sync actions in the provider's side drawer.

## [1.1.0] - 2026-06-28

### Added
- **API Token Authentication**: Added optional `api.auth_token` configuration to authenticate REST APIs and WebSocket endpoints (via Bearer header token, query parameter `?token=...`, or WebSocket Subprotocols).
- **IP-based Rate Limiting**: Added client IP-based token-bucket rate limiter using Go's `golang.org/x/time/rate`, offering global configurable request limits via `api.rate_limit`.
- **Mihomo Core Reverse Proxy**: Overhauled route `/api/v1/mihomo/api/*path` to proxy all standard HTTP methods and WebSocket upgrades using `httputil.ReverseProxy` and Gorilla `websocket` tunnels. Enables secure localhost-only binding (127.0.0.1:9090) of the Mihomo external controller.
- **Frontend Token Integration**: Updated web SPA services (`api.ts` and `ws.ts`) to transparently retrieve and append the authorization token from client local storage.
- **CI Workflow Hardening**: Integrated frontend Vitest execution and backend tests into Git Action checks.

## [1.0.0] - 2026-06-28

### Added
- **Logs Export Formats**: Added client-side export options to download filtered logs in raw TXT, CSV spreadsheet, or structured JSON format.
- **Swagger UI Integration**: Added a direct link in the Settings page to access the built-in Swagger API documentation console served at `/docs/index.html`.
- **Keyboard Shortcuts**: Added Monaco Editor system keyboard shortcuts `Ctrl+S` (Save current), `Ctrl+Shift+S` (Save All), `Ctrl+Alt+Z`/`Ctrl+Alt+R` (Revert Draft), `Alt+D` (Toggle Diff View), and `Alt+V` (Validate Config).
- **Config Editor Diff View**: Added side-by-side Monaco DiffEditor comparison support to preview modified properties against saved disk buffers before persisting configuration changes.

### Changed
- **Backup Retention Hardening**: Hardened Backup service retention cleaning routines. The service now checks for OS file removal errors, logs failures correctly, and automatically executes retention when creating backups.
- **API Error Propagation**: Updated backend Mihomo API proxies to check and return raw connection and IO read errors instead of silent zero-value responses.
- **Config Editor File Layouts**: Corrected config editor update routing on the frontend so configs, proxy providers, and rule providers save to their correct backend directories.
- **Go Version Bump**: Updated backend toolchain compile configuration `go.mod` target to Go 1.24.
- **Code Splitting**: Wrapped all major frontend views in lazy dynamic imports to decrease primary bundle footprint.
- **Smoke Build Separation**: Split OpenWrt SDK image generation workflows in CI into a lightweight `smoke_build` and full release matrices to optimize validation speed.

### Fixed
- **OpenWrt 25.12 Toolchain Compatibility**: Added dynamic Go binary location fallback wrappers to support OpenWrt 25.12's new versioned `go1.26` binary resolution.
- **Infinite Backup Recursion**: Explicitly white-listed active runtime configuration folders for the backup archive to prevent infinite zip recursion when walking working directories.
- **DOMPurify Vulnerability**: Updated npm dependency overrides to patch security package warnings.
- **Empty Catches Audit**: Surfaced 19 previously empty `catch` blocks in frontend calls to proper toast and console logs interface handlers.

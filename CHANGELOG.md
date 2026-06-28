# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

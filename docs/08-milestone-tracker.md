# Milestone Tracker

This document is used to track the **actual progress status** per milestone from the planning stack:

- [`05-roadmap.md`](05-roadmap.md)
- [`06-implementation-plan.md`](06-implementation-plan.md)
- [`07-issue-templates.md`](07-issue-templates.md)
- [`09-roadmap-gap-audit.md`](09-roadmap-gap-audit.md)

This document is different from the roadmap:
- roadmap = direction and priorities
- implementation plan = execution plan
- milestone tracker = actual work status, blockers, and next actions

Currently, the tracker is at the initial baseline, so most statuses are still `planned`.

---

## Status Legend

- `planned` — defined, not yet started
- `ready` — scope is clear enough to start working on
- `in progress` — actively being worked on
- `blocked` — cannot proceed without another dependency/decision
- `done` — completed according to the agreed definition of done

---

## Tracker Summary

| Milestone | Status | Priority | Readiness | Main Gap Type | Main Blocker | Next Action |
|-----------|--------|----------|-----------|---------------|--------------|-------------|
| M1 — Logs and Diagnostics Baseline | done | High | High | UI-heavy + mixed | none for v1 scope | move to M3 or deepen diagnostics later |
| M2 — Provider and Backup Operations | done | High | High | Mixed | none for baseline scope | move to M3 config maturity or deepen provider validation |
| M3 — Config Editor Maturity | done | High | Medium-High | Mixed, backend-led | none for baseline scope | move to M4 or deepen inline lint ergonomics later |
| M4 — Profiles / Subscriptions Workspace | done | High | Medium | API-heavy | none for baseline scope | move to M5 or deepen scheduler/automation next |
| M5 — Traffic and Connections Workspace | done | High | Medium | Mixed, backend-led | none for baseline scope | move to M6 or deepen real-time charting next |
| M6 — Backup Safety and Restore Policies | done | Medium | Medium | API-heavy, backend-led | none | skip M7 for now, continue polish or routing if needed |
| M7 — Auth, Audit, Hardening | done | High | Medium | API-heavy | none | maintain and configure tokens / rate limits |
| M8.1 — Routing Mode Orchestration | deferred | Medium-High | Low-Medium | API-heavy + high-risk | not critical for current phase | implement when routing UX/orchestration is truly needed |
| M8.2 — Packaging and OpenWrt Distribution Maturity | done | Medium | High | deploy/devex heavy | none for baseline scope | maintain CI/docs/install parity |

---

## Milestone Detail

### M1 — Logs and Diagnostics Baseline
- **Status:** `done`
- **Why:** M1.1 and M1.2 have landed as operational baseline R1
- **Issue set:**
  - [x] M1.1 — Stabilize log UX and stream contract
  - [x] M1.2 — Diagnostics page v1
- **Delivered:**
  - log websocket now sends stable envelope events (`kind`, `source`, `level`, `message`, `timestamp`, `status/code` for status events)
  - logs page has search, level filter, order toggle, stream status, reconnect visibility, and more predictable autoscroll
  - v1 diagnostics page available from UI with runtime/path/outbound/DNS checks + copyable output
- **Blockers:**
  - none for v1 scope
- **Next action:**
  - if observing observability further, add richer health model / remediation hints / deeper traffic drilldown

### M2 — Provider and Backup Operations
- **Status:** `done`
- **Why:** provider ops now have a dedicated workspace, and backup workspace has been upgraded
- **Issue set:**
  - [x] M2.1 — Dedicated provider operations UI
  - [x] M2.2 — Backup history and restore workspace
- **Delivered:**
  - backup history now displays with size + time metadata
  - restore can be done from upload or from history items on the server
  - delete history item is available from the UI
  - `/providers` route is now a dedicated workspace for proxy/rule providers
  - provider inspector shows quick metadata (`type`, `interval`, `behavior`, `url`, `path`) and content preview
  - create/upload/rename/download/delete provider is no longer restricted to just the generic manager
- **Blockers:**
  - none for M2 baseline scope
- **Next action:**
  - if continuing this area, focus on richer provider validation / last-sync / health-refresh semantics

### M3 — Config Editor Maturity
- **Status:** `done`
- **Why:** validation and workflow polish baseline editor is safe enough for actual changes
- **Issue set:**
  - [x] M3.1 — Config validation pipeline
  - [x] M3.2 — Editor workflow polish
- **Delivered:**
  - `/api/v1/mihomo/configs/validate` endpoint available for YAML parse + Mihomo semantic checks when binary is present
  - config editor now has validate button, status badge, and validation result panel
  - invalid config blocked before save
  - save all, revert current tab, keyboard shortcuts (Ctrl+S), and dirty state tracking (unsaved indicator) available
- **Blockers:**
  - none
- **Next action:**
  - if deepening, focus on line-level lint markers and richer diff/revision workflows

### M4 — Profiles / Subscriptions Workspace
- **Status:** `done`
- **Why:** core subscription backend capabilities are implemented and integrated into a baseline workspace UI
- **Issue set:**
  - [x] M4.1 — Subscription domain model and API
  - [x] M4.2 — Profiles UI workspace
- **Delivered:**
  - `Subscription` DB model / Repo / Service implemented with SQLite persistence
  - `/api/v1/subscriptions` endpoints (CRUD, refresh)
  - HTTP client specifically for subscription fetches (handles User-Agent, timeouts)
  - minimal subscription entity now has `id`, `name`, `url`, `provider_filename`, `provider_path`, `update_interval`, `enabled`, `status`, `proxy_count`, `last_refresh_at`, `last_success_at`, `last_error`
  - subscription also materializes proxy provider YAML to `proxy_providers/` ready for use in subsequent workflows
  - workspace UI has list/search, summary cards, create/edit/delete/refresh flows, and inspector panel
- **Blockers:**
  - none for baseline scope
- **Next action:**
  - cross-subscription activation/workflow automation is not yet available
  - if deepening this area, focus on scheduler state, auto-refresh, and activate/import flows

### M5 — Traffic and Connections Workspace
- **Status:** `done`
- **Why:** M5.1 and M5.2 have landed
- **Issue set:**
  - [x] M5.1 — Traffic metrics v2
  - [x] M5.2 — Connections workspace
- **Delivered:**
  - `Connections` UI panel with list and active state monitoring
  - connections search, sorting, and detail view
  - real-time traffic chart with visual differentiation (up/down)
  - historical metric aggregation
- **Blockers:**
  - none for baseline scope
- **Next action:**
  - if deepening, focus on real-time updates, chart visualization, and connection history

### M6 — Backup Safety and Restore Policies
- **Status:** `done`
- **Why:** M6.1 and M6.2 landed
- **Issue set:**
  - [x] M6.1 — Backup automation and retention
  - [x] M6.2 — Remote backup targets
- **Delivered:**
  - backup service layer (`internal/service/backup`) with create, list, delete, restore, retention
  - `BackupConfig` available in `config.Config` (auto_backup_enabled, max_backups, max_age_days, backup_dir)
  - `BackupStatus` endpoint for monitoring backup state
  - `POST /backup/retention` for manual retention trigger
  - automatic pre-restore backup before restore operations
  - remote target abstraction with WebDAV implementation
  - connectivity test endpoint `/backup/remote/test/:name`
  - sync endpoint `/backup/remote/sync/:name`
  - sync status endpoint `/backup/remote/status/:name`
  - upload endpoint `/backup/remote/upload/:name/:filename`
  - frontend backup page showing status, retention button, remote target list, test connection, and sync now
- **Blockers:**
  - none
- **Next action:**
  - skip M7 for trusted LAN, continue product polish or routing/distribution follow-up as practically needed

### M7 — Auth, Audit, Hardening
- **Status:** `done`
- **Why:** API token authentication, Mihomo reverse-proxy layout, and per-IP rate limiting have been implemented
- **Issue set:**
  - [x] M7.1 — Auth and session model
  - [x] M7.2 — Auditability and reliability hardening
- **Delivered:**
  - TokenAuth middleware checks HTTP Bearer tokens, query parameter `?token=...`, or WebSocket subprotocol headers
  - RateLimit middleware restricts query requests per IP with standard token-bucket limiter and background visitor cleaner
  - Mihomo core API redirection converted to a full Any-method reverse proxy with internal WebSocket tunneling on the Gin port
- **Blockers:**
  - none
- **Next action:**
  - maintain and configure tokens / rate limits in the mihombreng.yaml file

### M8.1 — Routing Mode Orchestration
- **Status:** `deferred`
- **Why:** high value but high risk, not critical for the current phase
- **Issue set:**
  - [ ] M8.1 — Routing mode orchestration
- **Blockers:**
  - routing contract not yet mature
  - apply/rollback/recovery semantics are unclear
- **Next action:**
  - proceed only if runtime orchestration is truly needed outside the trusted LAN baseline flow

### M8.2 — Packaging and OpenWrt Distribution Maturity
- **Status:** `done`
- **Why:** packaging baseline, LuCI baseline, and OpenWrt CI/CD flow have landed
- **Issue set:**
  - [x] M8.2 — Packaging and OpenWrt maturity
- **Delivered:**
  - OpenWrt SDK package baseline for core package + LuCI package
  - smoke built on `dev` / PR (`x86_64 + openwrt-24.10`)
  - full build on `master` / manual dispatch (4 arch × 2 OpenWrt branches)
  - split package formats: `openwrt-24.10 -> .ipk`, `openwrt-25.12 -> .apk`
  - CI feed structure using mounted `/feed` workspace instead of source clone during SDK build
  - smoke build placeholder strategy for heavy assets to ensure faster dev CI
  - more consistent docs/install baseline for OpenWrt and Linux
- **Blockers:**
  - none for baseline scope
- **Next action:**
  - maintain docs/install parity, clean up developer experience, and continue only if further packaging polish is needed

---

## Current Recommended Start Order

If starting from this tracker, the safest work order is:

1. **M1**
2. **M2**
3. **M3**
4. **M5**
5. **M4**
6. **M6**
7. **M8.2**
8. **M7**
9. **M8.1**

Reasons:
- M1/M2/M3 have the clearest baselines
- M5 is closer to observability and can aid M4 design
- M8.2 turned out to be low-risk and has landed as a distribution/devex lane
- M7 and M8.1 are riskier, so keep them from being taken on too early unless there is an urgent deploy/security need

---

## Update Rules

When this tracker is actively used, the minimum update per milestone should record:

- latest status
- new blockers
- which issues have been opened
- which issues have been completed
- nearest next action

If starting work on a milestone, change:
- `Status`
- `Main Blocker`
- `Next Action`

so that the tracker remains an operational document, rather than a passive archive.

# Implementation Plan

This document is an execution derivative of [`05-roadmap.md`](05-roadmap.md).

While `05-roadmap.md` answers **"what do we want to become and what is the priority order?"**, this document answers:

- which milestones should be executed first
- what implementation issues belong to each milestone
- which backend/frontend modules are likely affected
- the definition of done that can be used for sprint planning

This document remains **planning-only**. No code changes are implied merely because an item appears here.

---

## Planning Rules

### Backend-first when

- the feature needs a new data shape
- the feature needs a new endpoint
- the feature requires validation / scheduler / retries / audit / auth
- the feature requires recovery / rollback / runtime metadata

### Frontend-first when

- the backend already exists, but the UX is generic or difficult to use
- the feature merely organizes the presentation of already available data
- changes focus on navigation, layout, filters, sorting, responsiveness, or visual hierarchy

### Vertical-slice is suitable when

- the feature is small but touches both endpoints and UI concurrently
- examples: logs v2, diagnostics v1, backup history v1

---

## Milestone Order

The most logical implementation order at this time:

1. **M1 — Logs and Diagnostics Baseline**
2. **M2 — Provider and Backup Operations**
3. **M3 — Config Editor Maturity**
4. **M4 — Profiles / Subscriptions Workspace**
5. **M5 — Traffic and Connections Workspace**
6. **M6 — Backup Safety and Restore Policies**
7. **M8.2 — Packaging and OpenWrt Distribution Maturity**
8. **M7 — Auth, Audit, Hardening**
9. **M8.1 — Routing Mode Orchestration**

---

## Milestone Status Matrix

| Milestone | Priority | Current State | Backend Load | Frontend Load | Risk | Depends On |
|-----------|----------|---------------|--------------|---------------|------|------------|
| M1 — Logs and Diagnostics Baseline | High | Implemented on dev baseline | Medium | Medium | Low-Medium | Existing logs/diagnostic endpoints |
| M2 — Provider and Backup Operations | High | Implemented on dev baseline | Medium | Medium | Low-Medium | Existing file CRUD + backup endpoints |
| M3 — Config Editor Maturity | High | Baseline delivered | Medium | Medium | Medium | Existing editor + config APIs |
| M4 — Profiles / Subscriptions Workspace | High | Baseline delivered | High | High | Medium-High | M3 helpful, but not strictly required |
| M5 — Traffic and Connections Workspace | High | Baseline delivered | Medium-High | High | Medium | Existing snapshot/stream endpoints |
| M6 — Backup Safety and Restore Policies | Medium | Baseline delivered | High | Medium | Medium | M2 helpful |
| M8.2 — Packaging and OpenWrt Distribution Maturity | Medium | Implemented on dev baseline | Medium | Low-Medium | Low-Medium | deploy/systemd/docker/docs helpful |
| M7 — Auth, Audit, Hardening | High | Baseline delivered | High | Medium | High | None, but intentionally skipped for trusted LAN |
| M8.1 — Routing Mode Orchestration | Medium-High | Partial backend exists, UX missing | High | Medium | High | Routing service stabilization |

### Matrix Notes

- **Current State**
  - `Baseline exists` = main features are already usable
  - `Partial baseline exists` = foundation is present, but UX/contract is not yet mature
  - `Mostly missing` = needs new domain/API/UI
- **Backend Load / Frontend Load** are planning estimates, not final measurements
- **Risk** assesses the likelihood of design flaws or disruption to runtime operations

---

## Milestone M1 — Logs and Diagnostics Baseline

### Goal
Raise observability quality as quickly as possible without significantly changing the backend architecture.

### Issue M1.1 — Stabilize log UX and stream contract

**Backend modules**
- `backend/internal/http/handler/stream/`
- `backend/internal/http/handler/mihomo/`
- `backend/internal/http/router/router.go`

**Frontend modules**
- `web/src/app/logs/page.tsx`
- `web/src/hooks/use-logs.ts`
- `web/src/services/ws.ts`
- `web/src/components/terminal/`

**Scope**
- define a stable log event shape
- determine clear / reconnect / pause / buffer behaviors
- upgrade the logs page UX without altering the visual identity

**Definition of done**
- logs page has an order toggle, mature search/filter, and predictable autoscroll
- reconnect and clear behaviors are not confusing to the operator
- log payload is documented clearly enough for the frontend

**Implementation note**
- landed on `dev`: backend stream now sends structured log/status envelopes; frontend logs page now has stream status, search, sort toggle, and held autoscroll behavior

### Issue M1.2 — Diagnostics page v1

**Backend modules**
- `backend/internal/http/handler/app/`
- `backend/internal/http/handler/mihomo/`
- `backend/internal/http/handler/dns/`
- `backend/internal/http/router/router.go`

**Frontend modules**
- `web/src/app/` (new diagnostics page)
- `web/src/services/api.ts`
- `web/src/types/`
- `web/src/components/ui/`

**Scope**
- mihomo reachability test
- outbound IP / geo checks
- DNS check
- runtime path / permission checks

**Definition of done**
- admins can check basic health without SSH
- test results are clearly distinguished between success / warning / failure
- operators can copy critical results for debugging

**Implementation note**
- landed on `dev`: `/api/v1/app/diagnostics` + diagnostics UI page with runtime/path/outbound/DNS checks and copyable diagnostic cards

---

## Milestone M2 — Provider and Backup Operations

### Goal
Make daily provider and backup operations safer and more operational.

### Issue M2.1 — Dedicated provider operations UI

**Backend modules**
- `backend/internal/http/handler/mihomo/`
- `backend/internal/http/router/router.go`
- `backend/pkg/config/`

**Frontend modules**
- `web/src/app/manager/page.tsx`
- `web/src/app/mihomo/config/page.tsx`
- `web/src/services/api.ts`
- `web/src/types/`

**Scope**
- separate provider UX from the generic file manager
- add operational metadata and update actions
- prepare clearer error/empty/loading states

**Definition of done**
- operators do not need to enter the editor/file manager for daily provider work
- proxy providers and rule providers have a more task-oriented panel
- empty/error/loading states are consistent

**Implementation note**
- landed on `dev`: `/providers` workspace dedicated to proxy/rule providers with search, preview, metadata inspector, create/upload/rename/download/delete actions

### Issue M2.2 — Backup history and restore workspace

**Backend modules**
- `backend/internal/http/handler/backup/`
- `backend/internal/http/router/router.go`

**Frontend modules**
- `web/src/app/backup/page.tsx`
- `web/src/services/api.ts`
- `web/src/types/`

**Scope**
- display backup history
- backup metadata
- restore from history
- delete history items

**Definition of done**
- old backups can be viewed and restored from the UI
- restore flow is not just manual file uploads
- operators get backup context before restoring

**Implementation note**
- landed on `dev`: backup history now displays with metadata, restores can be done from history items, and delete actions are available from the backup workspace

---

## Milestone M3 — Config Editor Maturity

### Goal
Make the config editor safe to use for actual changes.

### Issue M3.1 — Config validation pipeline

**Backend modules**
- `backend/internal/http/handler/mihomo/`
- `backend/internal/converter/`
- `backend/pkg/config/`
- `backend/internal/http/router/router.go`

**Frontend modules**
- `web/src/app/mihomo/config/page.tsx`
- `web/src/services/api.ts`
- `web/src/types/`

**Scope**
- validate without apply
- error envelope for line/field context
- prepare future diff/revision support

**Definition of done**
- operators can validate before saving/applying
- config errors do not stop at generic messages
- validation contract is stable enough for the editor UI

**Implementation note**
- landed on `dev`: endpoint `/api/v1/mihomo/configs/validate` + config editor validate action, status badges, validation result panel, and save guard when invalid

### Issue M3.2 — Editor workflow polish

**Frontend modules**
- `web/src/app/mihomo/config/page.tsx`
- `web/src/components/ui/`
- `web/src/utils/`

**Scope**
- markers
- tabs state refinement
- save/validate/activate separation
- safer unsaved-changes flow

**Definition of done**
- the editor feels like an admin workspace, not a huge textarea
- save, validate, and activate are not conflated
- unsaved changes behavior is safer and clearer

**Implementation note**
- landed on `dev`: save all, revert current tab, keyboard shortcuts, unsaved-change leave warning, richer toolbar state, and clearer separation between validate / save / activate actions

---

## Milestone M4 — Profiles / Subscriptions Workspace

### Goal
Make subscriptions a primary feature, not just a converter input or manual file.

### Issue M4.1 — Subscription domain model and API

**Backend modules**
- `backend/internal/domain/`
- `backend/internal/service/`
- `backend/internal/http/handler/`
- `backend/internal/http/router/router.go`
- `backend/pkg/config/`

**Scope**
- define the profile/subscription entity
- import URL / upload / refresh / scheduler state
- retry/backoff metadata

**Definition of done**
- subscriptions are no longer modeled as just regular files
- refresh status can be read per item
- scheduler state has a clear contract

**Implementation note**
- landed on `dev` baseline: JSON-backed subscription entity + CRUD/refresh API + provider YAML materialization. Scheduler/backoff contract still pending follow-up.

### Issue M4.2 — Profiles UI workspace

**Frontend modules**
- `web/src/app/` (new profiles page)
- `web/src/services/api.ts`
- `web/src/types/`
- `web/src/components/ui/`

**Scope**
- list of subscriptions
- import and activate
- batch actions
- refresh and failure states

**Definition of done**
- subscriptions can be fully operated from the UI
- operators do not need to manage everything as manual files
- import, refresh, activate, and batch actions have clear flows

**Implementation note**
- landed on `dev` baseline: `/profiles` workspace with list/search, summary cards, create/edit/delete/refresh flow, and inspector panel for subscription metadata

---

## Milestone M5 — Traffic and Connections Workspace

### Goal
Provide deeper runtime visibility for debugging and tuning.

### Issue M5.1 — Traffic metrics v2

**Backend modules**
- `backend/internal/http/handler/mihomo/`
- `backend/internal/http/handler/stream/`
- `backend/internal/http/router/router.go`

**Frontend modules**
- `web/src/hooks/use-mihomo-stats.ts`
- `web/src/app/page.tsx`
- `web/src/app/` (traffic views if separated)
- `web/src/components/status/`

**Scope**
- richer traffic samples
- chart-friendly payload
- faster dashboard insight

**Definition of done**
- traffic is not just displayed as snapshot numbers
- charts can be used to read brief trends
- payloads are lightweight enough for routine updates

**Implementation note**
- landed on `dev`: endpoint `/api/v1/mihomo/metrics/traffic` aggregates connections by rule/chain/network/type. `/traffic` workspace page with summary cards + 4 breakdown tables.

### Issue M5.2 — Connections workspace

**Backend modules**
- `backend/internal/http/handler/stream/`
- `backend/internal/http/handler/mihomo/`
- `backend/internal/http/router/router.go`

**Frontend modules**
- `web/src/app/` (new connections page)
- `web/src/services/api.ts`
- `web/src/types/`
- `web/src/components/ui/`

**Scope**
- active and recent connections
- search/sort/detail
- optional geo/rule visibility

**Definition of done**
- admins can see who/what is using connections
- the connections page can be used to triage runtime issues
- filtering and sorting are sufficient for operational use-cases

**Implementation note**
- landed on `dev`: `/connections` workspace with search, summary cards, connection table, detail panel, and close actions. Backend endpoints `/mihomo/metrics/connections` + `DELETE /mihomo/connections/:id`.

---

## Milestone M6 — Backup Safety and Restore Policies

### Goal
Ensure major config changes always have a rapid recovery path.

### Issue M6.1 — Backup automation and retention

**Backend modules**
- `backend/internal/service/`
- `backend/internal/http/handler/backup/`
- `backend/internal/http/router/router.go`
- `backend/pkg/config/`

**Scope**
- backup-on-change hooks
- retention policies
- background job safety

**Definition of done**
- critical changes automatically have safety nets
- retention prevents storage from growing wildly
- backup failures can be seen clearly

**Implementation note**
- landed on `dev`: backup service layer with create/list/delete/restore/retention. BackupConfig (auto_backup_enabled, max_backups, max_age_days, backup_dir). BackupStatus endpoint. Pre-restore automatic backups. Frontend status display + retention button.

### Issue M6.2 — Remote backup targets

**Backend modules**
- `backend/internal/service/`
- `backend/internal/http/handler/backup/`
- `backend/pkg/config/`

**Frontend modules**
- `web/src/app/backup/page.tsx`
- `web/src/services/api.ts`

**Scope**
- target abstraction
- WebDAV target support
- connectivity test and last sync state

**Definition of done**
- backup targets are not restricted to local-only
- operators can test target connectivity from the UI
- last sync status can be read

**Implementation note**
- landed on `dev`: remote target abstraction with WebDAV implementation. Connectivity test, sync, sync status, upload endpoints. Frontend remote target list with test connection and sync now buttons.

---

## Milestone M7 — Auth, Audit, Hardening

### Goal
Make mihombreng viable for environments broader than a trusted LAN.

### Issue M7.1 — Auth and session model

**Backend modules**
- `backend/internal/http/middleware/`
- `backend/internal/http/router/router.go`
- `backend/pkg/config/`
- `backend/cmd/server/`

**Frontend modules**
- `web/src/app/`
- `web/src/services/api.ts`
- `web/src/types/`

**Scope**
- single-admin login
- token/session storage policy
- protected API and stream access

**Definition of done**
- WebUI is no longer an open panel without protection
- session expiry and logout flows are clear
- protected endpoints and streams are consistent

### Issue M7.2 — Auditability and reliability hardening

**Backend modules**
- `backend/internal/http/middleware/`
- `backend/pkg/logger/`
- `backend/internal/http/handler/`

**Scope**
- request logging
- audit log
- error envelope
- timeout / retry conventions

**Definition of done**
- sensitive actions can be audited
- API responses are more consistent for the UI
- timeout and retry policies are not ad-hoc

**Implementation note**
- Landed: TokenAuth (HTTP Bearer + WS query/protocol checks) and RateLimit (IP-based token bucket) middleware implemented and integrated. Overhauled `ProxyToMihomoAPI` reverse proxy using native `httputil.ReverseProxy` alongside custom bi-directional Gorilla WebSocket tunnels to facilitate secure 127.0.0.1 binding of the Mihomo external controller interface.

---

## Milestone M8.1 — Routing Mode Orchestration

### Goal
Finalize network mode controls for Linux/OpenWrt hosts without sacrificing current safety baselines.

### Issue M8.1 — Routing mode orchestration

**Backend modules**
- `backend/internal/service/routing/`
- `backend/internal/domain/`
- `backend/internal/http/handler/mihomo/`
- `backend/internal/http/router/router.go`

**Frontend modules**
- `web/src/app/`
- `web/src/services/api.ts`
- `web/src/types/`

**Scope**
- mode detection
- apply/rollback
- recovery hints
- host capability validation

**Definition of done**
- routing modes can be managed from the UI safely
- apply failures have a clear recovery path
- host prerequisites can be read by operators before applying

## Milestone M8.2 — Packaging and OpenWrt Distribution Maturity

### Goal
Mature Linux/OpenWrt packaging and CI/CD distribution lanes without mixing these concerns with runtime routing orchestration.

### Issue M8.2 — Packaging and OpenWrt maturity

**Backend / deploy modules**
- `deploy/openwrt/`
- `deploy/systemd/`
- `deploy/docker/`
- `scripts/`
- `defaults/`
- `docs/04-installation.md`
- `docs/openwrt/`
- `.github/workflows/build-openwrt.yml`

**Scope**
- packaging consistency
- OpenWrt distribution quality
- deployment guidance parity
- CI split between fast smoke validation and full release validation

**Definition of done**
- deployment/upgrade story is cleaner on Linux and OpenWrt
- artifacts and docs are more consistent
- operators know the recommended install/upgrade paths
- OpenWrt build lane has a dev-friendly smoke path and a production-faithful full path

**Implementation note**
- landed on `dev`: OpenWrt SDK core package + LuCI package, smoke build (`dev`/PR), full matrix build (`master`/manual), local `/feed` source-copy flow, `.ipk`/`.apk` split, docs/install baseline updates

---

## Sprint Plan

### Sprint 1 — Observability and Operational Clarity

**Focus**
- M1.1 Stabilize log UX and stream contract
- M1.2 Diagnostics page v1
- M2.2 Backup history and restore workspace
- Foundation polish: loading / empty / error state consistency

**Outcome target**
- admins can observe the system more easily
- backup/restore is safer for daily use
- support/debugging relies less on SSH

### Sprint 2 — Config and Provider Maturity

**Focus**
- M2.1 Dedicated provider operations UI
- M3.1 Config validation pipeline
- M3.2 Editor workflow polish
- File operations hardening

**Outcome target**
- config editing is safer
- provider management no longer feels like a raw file browser
- operational errors are reduced

### Sprint 3 — Product-defining Mihomo Management

**Focus**
- M4.1 Subscription domain model and API
- M4.2 Profiles UI workspace
- M5.1 Traffic metrics v2
- M5.2 Connections workspace

**Outcome target**
- mihombreng graduates from a basic admin tool to a more comprehensive Mihomo control plane
- subscription/provider/runtime workflows start coming together in one panel

---

## Notes for Future Issue Creation

When implementation issues are created later, each issue should ideally contain:

- a brief objective
- affected modules
- API changes, if any
- UI/UX changes, if any
- constraints / compatibility notes
- definition of done
- explicit out-of-scope

To prevent scope creep within an issue, it is safer when:

- a single issue focuses on a small vertical slice
- auth is not mixed with observability milestones
- routing modes are not mixed with subscription UX
- backup automation is not mixed with provider UI unless they share a single workflow
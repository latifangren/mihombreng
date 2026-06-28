# Roadmap Gap Audit

This document maps the roadmap to **API gaps** and **UI gaps**.

Its purpose:

- show what is still missing in backend contracts
- show what is still missing in frontend surfaces
- help determine if a certain milestone should be worked on **backend-first**, **frontend-first**, or as a **vertical-slice**

This document is **audit-only**. It does not imply automatic code changes.

Primary references:
- [`05-roadmap.md`](05-roadmap.md)
- [`06-implementation-plan.md`](06-implementation-plan.md)

---

## Reading Guide

### API gap
Means the necessary backend contract, endpoint, payload, validation, auth, scheduler, or metadata does not exist or is not mature enough yet.

### UI gap
Means the backend baseline exists, but the page, workflow, state management, visual affordance, or operator experience is not yet adequate.

### Mixed gap
Means the feature requires both backend and frontend simultaneously because the missing pieces are not just display or just contracts.

---

## Summary Matrix

| Area | Current Baseline | Main Gap Type | Recommended Shape |
|------|------------------|---------------|-------------------|
| Logs v2 | Stream + clear + baseline pause/filter exist | UI-heavy + small API polish | Frontend-first / vertical-slice |
| Diagnostics | Baseline DNS + IP/geo exist | Mixed gap | Vertical-slice |
| Provider operations | Baseline file CRUD exists | UI-heavy + API metadata gap | Vertical-slice |
| Backup history | Baseline create/list/restore exists | Mixed gap | Vertical-slice |
| Config validation | Baseline editor exists | Mixed gap | Backend-first |
| Profiles/subscriptions | Converter exists, workspace does not | API-heavy | Backend-first |
| Traffic dashboard v2 | Baseline snapshot exists | Mixed gap | Backend-first then frontend |
| Connections workspace | Baseline snapshot/stream exists | Mixed gap | Backend-first then frontend |
| Runtime health model | Baseline status/uptime/version exists | API-heavy | Backend-first |
| Auto-backup / retention | Baseline manual backup exists | API-heavy | Backend-first |
| Auth / audit / hardening | Implemented (token auth + rate limit) | None (resolved) | Completed |
| Routing mode orchestration | Partial baseline service exists | API-heavy + high-risk UI | Backend-first |

---

## A. Logs v2

### Existing baseline
- log stream exists
- baseline reconnect exists
- baseline pause/resume exists
- baseline level filter exists
- generic clear endpoint exists

### API gaps
- event shape needs to be stabilized and better documented
- unclear if additional metadata is needed for search/highlight/download sessions
- no explicit contract for ordering semantics or replay behavior after reconnect

### UI gaps
- no order toggle
- no search within buffer
- no virtualized long-session view
- autoscroll behavior is not well-defined
- no copy/download session log

### Verdict
- **Main gap:** UI gap
- **Recommended:** frontend-first with minor contract polish in backend/WS layer

---

## B. Diagnostics Page

### Existing baseline
- DNS lookup exists
- basic outbound IP / geo endpoint exists
- basic Mihomo status exists

### API gaps
- no unified diagnostics endpoint
- no specific contract for permission/path/runtime checks
- no standard result shape for tests (`ok/warn/fail`, details, suggestions)

### UI gaps
- no dedicated diagnostics page
- no fast operator-friendly test result presentation
- no copy/export action for lightweight audit results

### Verdict
- **Main gap:** mixed gap
- **Recommended:** vertical-slice

---

## C. Provider Operations

### Existing baseline
- baseline proxy provider CRUD exists
- baseline rule provider CRUD exists
- editor can open provider/rule files

### API gaps
- no rich operational provider metadata
- no explicit single / update all provider action
- no status source, last refresh, error state, quota/expiry contract

### UI gaps
- providers still displayed like regular files
- no task-oriented panel for daily provider operations
- no filtering, state badges, error summaries, or timestamp UX

### Verdict
- **Main gap:** UI gap, but requires extra API metadata
- **Recommended:** vertical-slice

---

## D. Backup History and Restore Maturity

### Existing baseline
- backup create exists
- basic backup list endpoint exists
- restore upload exists
- basic restore confirmation exists

### API gaps
- backup list still looks minimal, not necessarily rich in metadata
- no history item deletion
- no retention / source / note / relationship metadata
- no auto-backup policy contract

### UI gaps
- backup page is not yet a history workspace
- restore is heavily dominated by manual upload
- no timeline/history visibility
- no remote target configuration UX

### Verdict
- **Main gap:** mixed gap
- **Recommended:** vertical-slice for history, backend-first for retention/automation

---

## E. Config Validation Pipeline

### Existing baseline
- config editor exists
- basic YAML save exists

### API gaps
- no dedicated check endpoint (e.g. `mihomo -t`) without restarting
- no standard validation error payload (line numbers, messages, context)
- no dry-run application tests

### UI gaps
- no pre-save linting
- save action doesn't show semantic error confidence
- no dirty state / line error markers

### Verdict
- **Main gap:** API gap to form the foundation, then UI gap
- **Recommended:** backend-first

---

## F. Profiles / Subscriptions Workspace

### Existing baseline
- `convert_proxy` endpoint exists
- config generation is mostly manual or uses generic APIs

### API gaps
- no domain model for a "subscription" entity (URL, update interval, last updated)
- no subscription refresh orchestration/cron
- no metadata extraction specific to quotas
- no aggregation rules (merging multiple subscriptions)

### UI gaps
- no workspace section for profile management
- no subscription card / refresh action / status badge

### Verdict
- **Main gap:** API gap
- **Recommended:** backend-first

---

## G. Traffic Dashboard v2

### Existing baseline
- basic traffic stats exist
- some WebSocket implementations exist but UI might not heavily rely on them yet

### API gaps
- historical / time-series metric retention might not be stable
- bandwidth limit contract (if any) is not visible
- lack of clear aggregation metrics

### UI gaps
- no comprehensive time-series chart / short-vs-long window view
- no peak/average/current comparison cards
- dashboard is still snapshot-only

### Verdict
- **Main gap:** mixed gap, starting with API shape
- **Recommended:** backend-first then frontend

---

## H. Connections Workspace

### Existing baseline
- total connection count snapshot exists
- basic stream endpoint exists

### API gaps
- unclear payload richness for host, rule, duration, upload/download, last activity
- no contract for recent-closed retention
- no close-connection / bulk-close semantics if intended to be supported
- geo/rule enrichment might not exist or be stable

### UI gaps
- no dedicated page
- no search/sort/detail UX
- no active vs recent split
- no detail drawer/panel

### Verdict
- **Main gap:** mixed gap, starting with API richness
- **Recommended:** backend-first then frontend

---

## I. Runtime Health Model

### Existing baseline
- running/stopped status exists
- baseline uptime exists
- baseline version exists

### API gaps
- no restart counts
- no last exit reason
- no desired vs actual state
- no recovery metadata
- no stale runtime/socket reconciliation visibility

### UI gaps
- no richer service health surface
- operators cannot know recovery history from the UI

### Verdict
- **Main gap:** API gap
- **Recommended:** backend-first

---

## J. Auto-backup, Retention, Remote Targets

### Existing baseline
- manual backup exists
- manual restore exists

### API gaps
- no auto-backup trigger contract
- no retention policy config
- no remote target abstraction / credential model
- no sync state/report contract

### UI gaps
- no auto-backup settings
- no retention policy controls
- no remote target configuration UI

### Verdict
- **Main gap:** API gap
- **Recommended:** backend-first

---

## K. Auth, Audit, and Hardening

### Existing baseline
- Landed: TokenAuth (HTTP Bearer + WS query/protocol checks) and RateLimit (IP-based token bucket) middleware implemented. Overhauled proxy routes to use native ReverseProxy and Gorilla WebSocket tunnels for secure localhost binding of Mihomo CLI.

### API gaps
- none (addressed)

### UI gaps
- none (token and middleware fully integrated)

### Verdict
- **Main gap:** none (resolved)
- **Recommended:** Completed

---

## L. Routing Mode Orchestration

### Existing baseline
- partial service/routing layer exists
- OpenWrt/Linux deployment baseline exists

### API gaps
- mode detection/apply/status logic not mature
- rollback/recovery contract unclear
- host capability and prerequisite validation not surfaced as clean APIs

### UI gaps
- no safe routing mode switcher
- no preview, risk warning, recovery hints, verification UX

### Verdict
- **Main gap:** API gap with high runtime risk
- **Recommended:** backend-first

---

## Prioritization Guidance from Gap Audit

### Best vertical-slice candidates
- diagnostics page v1
- backup history v1
- provider operations v1
- logs v2

### Best backend-first candidates
- config validation pipeline
- profiles/subscriptions domain model
- runtime health model
- auto-backup/retention
- auth/audit/hardening
- routing mode orchestration

### Best frontend-first candidates
- logs UX polish after event shape is confirmed
- loading/empty/error consistency
- navigation and information architecture cleanup
- responsive admin polish

---

## Planning Recommendation

To minimize risk while maintaining progressive momentum:

1. Start from vertical-slices that provide fast operator value
   - logs v2
   - diagnostics v1
   - backup history v1
2. Continue to mixed but backend-led features
   - config validation
   - provider metadata/actions
   - traffic + connections payload enrichment
3. Start working on domain/API-heavy features
   - subscriptions workspace
   - runtime health model
   - auth/hardening
   - routing orchestration

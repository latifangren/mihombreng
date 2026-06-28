# Roadmap

This roadmap focuses on **mihombreng as a Linux server + WebUI for Mihomo**, rather than a desktop shell. The development direction emphasizes:

- stable core lifecycle control
- real-time observability
- secure management of configs / providers / subscriptions
- resilient server operations
- seamless OpenWrt integration and Linux deployment

Several roadmap items below are inspired by UX and operational patterns that have proven effective in Clash Verge, but tailored for a **server-admin WebUI** context.

> For detailed implementation breakdowns, module mapping, and sprint execution plans, see [`06-implementation-plan.md`](06-implementation-plan.md).

## Legend

- `[x]` available and usable as a baseline
- `[ ]` not yet available or not considered complete
- items that are **partially available** are marked with a baseline `[x]` and broken down into subsequent `[ ]` sub-items

## Current Status Snapshot

### Currently Available

- [x] ✅ Go backend featuring clean architecture patterns (handler / service / domain)
- [x] ✅ React + Vite + Tailwind frontend with a retro-brutalist theme
- [x] ✅ Basic Mihomo core lifecycle functionality (start / stop / restart)
- [x] ✅ Basic config editor
- [x] ✅ Basic file manager for configs / proxy providers / rule providers
- [x] ✅ Basic backup operations: create / list / restore
- [x] ✅ DNS lookup tools
- [x] ✅ Subscription converter tools
- [x] ✅ WebSocket log streaming with automatic reconnection
- [x] ✅ Logs workspace v1: stable event envelope, search/filter, sort toggle, stream status, predictable autoscroll
- [x] ✅ Diagnostics page v1: runtime / path / outbound / DNS checks without SSH
- [x] ✅ Backup history workspace v1: metadata list, restore from history, delete actions
- [x] ✅ Subscription domain/API baseline: CRUD, refresh metadata, generated provider YAML materialization
- [x] ✅ Profiles workspace baseline: list/search, create/edit/delete/refresh flow, operator inspector panel
- [x] ✅ Basic snapshot metrics (memory / traffic / connections)
- [x] ✅ Traffic metrics v2: aggregated by rule/chain/network/type + workspace page
- [x] ✅ Dashboard link to external Mihomo UI
- [x] ✅ Basic OpenWrt procd service integration
- [x] ✅ Basic Linux systemd deployment path

### Weak / Incomplete Areas

- [x] ✅ Routing mode UX and orchestration are implemented
- [x] ✅ Provider management has a baseline operational workspace with sync, health, and validation error panels
- [x] ✅ Subscription workspace has lifecycle automation, scheduler, and activation workflows integrated
- [x] ✅ Traffic / connections observability has real-time bandwidth velocity charts and connection stream updates
- [x] ✅ Config editor has validation + baseline workflow polish, but line-level lint markers and revision workflows are weak
- [x] ✅ Auth / rate limiting / audit / session hardening are implemented
- [x] ✅ Diagnostics page recovery triggers and targeted healing actions are implemented
- [x] ✅ Health model includes recovery actions and metadata
- [x] ✅ OpenWrt packaging and CI/CD baseline shipped (routing orchestration complete)

---

## Product Direction Summary

### A. Foundation and Core UX

- [x] ✅ Clean architecture backend baseline
- [x] ✅ Frontend shell baseline
- [x] ✅ Core operator tools baseline
- [ ] Navigation, loading, error, confirmation, timestamp, and feedback polish still need refinement

### B. Routing Modes and Network Control

- [x] ✅ TUN / Redirect / TProxy / Mixed mode orchestration end-to-end
- [x] ✅ Firewall policy management, cleanup, rollback, and verification flows
- [x] ✅ UI mode switcher, prerequisite checks, and recovery hints

### C. Profiles, Providers, and Config Operations

- [x] ✅ Config editor baseline
- [x] ✅ Proxy / rule provider CRUD baseline
- [x] ✅ Config validation, diff/revision safety, and activation flow maturity
- [x] ✅ Profiles / subscriptions workspace baseline as a primary feature
- [x] ✅ Dedicated operational provider management UI
- [ ] Stronger file operation safety

### D. Observability, Diagnostics, and Runtime Insight

- [x] ✅ Logs baseline
- [x] ✅ Snapshot traffic / connections / status baseline
- [ ] Logs v2
- [x] ✅ Traffic charts and richer metrics
- [x] ✅ Connections workspace baseline
- [x] ✅ Diagnostics page baseline
- [x] ✅ Rich runtime health model

### E. Backup, Restore, and Change Safety

- [x] ✅ Backup create / restore / list baseline
- [x] ✅ Backup history workspace v1
- [x] ✅ Auto-backup and retention (backup service layer, BackupConfig, retention endpoint)
- [ ] Rollback / last-known-good safety flows
- [x] ✅ Remote backup targets (WebDAV)

### F. Security, Authentication, and Production Hardening

- [x] ✅ Auth token/session layer
- [x] ✅ Rate limiting and login protection
- [x] ✅ Audit logging and request logging
- [ ] Error envelope, graceful shutdown, timeout/retry policy
- [ ] Deployment and upgrade safety improvements

### G. OpenWrt and Distribution Integration

- [x] ✅ OpenWrt procd baseline
- [x] ✅ OpenWrt SDK package baseline + LuCI package baseline
- [x] ✅ Multi-architecture build and packaging baseline (smoke/full CI, IPK/APK split)
- [ ] More mature LuCI / UCI integration
- [ ] Update flow and deployment guidance parity

### H. UX Polish and Responsive Admin Experience

- [ ] Clearer information architecture
- [ ] Responsive admin UX for narrow screens
- [ ] Dense mode for data-heavy pages
- [ ] Design system polish without sacrificing retro-brutalist identity

---

## Priority Waves

### Wave A — high impact, low-to-medium cost

- [ ] Logs v2
- [x] ✅ Dedicated provider management UI baseline
- [x] ✅ Monaco YAML validation
- [x] ✅ Backup history UI baseline
- [x] ✅ Diagnostics page v1 baseline

### Wave B — high impact, product-defining

- [x] ✅ Profiles / subscriptions workspace baseline
- [x] ✅ Traffic dashboard v2
- [x] ✅ Connections workspace baseline
- [x] ✅ Runtime health model
- [x] ✅ Auto-backup policies baseline

### Wave C — production readiness

- [x] ✅ Auth + session layer
- [x] ✅ Rate limiting + audit log
- [ ] Structured error model
- [ ] Upgrade / packaging safety improvements
- [x] ✅ OpenWrt distribution baseline

### Wave D — advanced network control

- [x] ✅ Full routing mode orchestration
- [x] ✅ Firewall policy recovery / rollback
- [x] ✅ Connectivity verification flows
- [ ] Linux / OpenWrt parity improvements

---

## Sprint Priorities

### Sprint 1 — observability and operational clarity
- [x] ✅ logs UX maturity baseline
- [x] ✅ diagnostics page v1 baseline
- [x] ✅ backup history and restore clarity baseline
- [ ] loading / empty / error consistency

### Sprint 2 — config and provider maturity
- [x] ✅ dedicated provider operations UI baseline
- [x] ✅ config validation pipeline baseline
- [x] ✅ editor workflow polish baseline
- [ ] file operation safety

### Sprint 3 — product-defining Mihomo management
- [x] ✅ subscription domain model and UI workspace baseline
- [x] ✅ traffic metrics v2 baseline
- [x] ✅ connections workspace baseline

---

## Milestones

Detailed execution milestones are separated into implementation documents to keep the main roadmap concise.

- [x] ✅ M1 — Logs and Diagnostics Baseline
- [x] ✅ M2 — Provider and Backup Operations
- [x] ✅ M3 — Config Editor Maturity
- [x] ✅ M4 — Profiles / Subscriptions Workspace
- [x] ✅ M5 — Traffic and Connections Workspace
- [x] ✅ M6 — Backup Safety and Restore Policies
- [x] ✅ M7 — Auth, Audit, Hardening
- [x] ✅ M8.1 — Routing Mode Orchestration
- [x] ✅ M8.2 — Packaging and OpenWrt Distribution Maturity baseline

See full details in [`06-implementation-plan.md`](06-implementation-plan.md).

---

## Deferred / Optional

The items below are valuable but are not core priorities for the baseline Linux server WebUI.

- [ ] Multi-user support with a role / permission model
- [ ] Full IPv6 operational support audit
- [ ] Notification center for important events
- [ ] Multi-host remote agent / node management
- [ ] Plugin / extension system
- [ ] Advanced rule visualization / dependency graph
- [ ] General scheduled jobs dashboard
- [ ] Built-in updater capable of writing its own binary across all environments
- [ ] Desktop-specific shell integration
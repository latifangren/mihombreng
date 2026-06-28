# Release Plan

This document maps **sprints -> milestones -> release trains**.

The goal is to:

- provide a realistic release order
- ensure each release train has a clear product narrative
- avoid releases that contain an overly broad mix of changes without a cohesive operator story

References:
- [`05-roadmap.md`](05-roadmap.md)
- [`06-implementation-plan.md`](06-implementation-plan.md)
- [`08-milestone-tracker.md`](08-milestone-tracker.md)
- [`10-dependency-map.md`](10-dependency-map.md)

This document is **planning-only**.

---

## Release Planning Principles

### 1. Releases must have an operator story
Each release should be explainable in a single, simple sentence, for example:
- "this release makes observability much more user-friendly"
- "this release makes config editing safer"

### 2. Avoid mixing too many risk classes
Do not mix the following within a single release:
- major authentication changes
- high-risk routing orchestration
- major subscription domain refactoring

unless the release train is explicitly dedicated to hardening/runtime.

### 3. Prefer vertical value slices
A smaller, focused release is better than a large release that mixes many concerns but feels incomplete.

### 4. Observability precedes risky orchestration
Before introducing major routing/network changes, ensure observability and diagnostics are sufficiently robust.

---

## Release Train Overview

| Release Train | Theme | Primary Milestones | Risk | Operator Value |
|---------------|-------|--------------------|------|----------------|
| R1 | Observability and Recovery Basics | M1, partial M2 | Low-Medium | High |
| R2 | Safer Config and Provider Operations | M2, M3 | Medium | High |
| R3 | Subscription-centric Control Plane | M4, partial M5 | Medium-High | Very High |
| R4 | Runtime Insight and Safety Net | M5, M6 | Medium-High | High |
| R5 | Secure and External-ready Panel | M7 | High | High |
| R6 | Advanced Routing and Distribution | M8 | High | High |

---

## Sprint-to-Release Mapping

## Sprint 1 -> Release Train R1

### Theme
Observability and recovery basics.

### Planned focus
- M1.1 — Stabilize log UX and stream contract
- M1.2 — Diagnostics page v1
- M2.2 — Backup history and restore workspace
- foundation polish for loading / empty / error consistency

### Release outcome
- operators can read logs more comfortably
- operators can perform basic health checks without SSH
- backup history becomes usable from the UI

### Release narrative
"Mihombreng is now significantly better for reviewing system health, reading logs, and basic recovery."

### Exit criteria
- diagnostics flow is usable
- logs flow feels mature enough for daily operations
- restoring no longer relies solely on blind manual uploads

---

## Sprint 2 -> Release Train R2

### Theme
Safer config and provider operations.

### Planned focus
- M2.1 — Dedicated provider operations UI
- M3.1 — Config validation pipeline
- M3.2 — Editor workflow polish
- file operations hardening

### Release outcome
- config editing is safer
- provider management is more operational, rather than just file-browser centric
- config errors are easier to understand

### Release narrative
"Mihombreng is now safer to use for editing configs and managing providers without fear of missteps."

### Exit criteria
- validate/save/activate flow is clear
- provider panel has adequate actions and metadata
- destructive file operations are safer

---

## Sprint 3 -> Release Train R3

### Theme
Subscription-centric control plane.

### Planned focus
- M4.1 — Subscription domain model and API
- M4.2 — Profiles UI workspace
- M5.1 — Traffic metrics v2
- M5.2 — Connections workspace (minimal first useful version)

### Release outcome
- subscriptions become a primary workflow
- traffic and connections begin to provide tangible runtime context
- the panel feels closer to a full Mihomo control plane

### Release narrative
"Mihombreng levels up from a rudimentary admin tool to a comprehensive subscription and runtime management panel."

### Exit criteria
- subscription import/refresh/activate is usable
- traffic is no longer snapshot-only
- connections page is minimally usable for triage

---

## Sprint 4 -> Release Train R4

### Theme
Runtime insight and safety net.

### Planned focus
- finalization of M5 if still partial
- M6.1 — Backup automation and retention
- M6.2 — Remote backup targets
- runtime health model enrichment if separated from R3

### Release outcome
- operational safety nets are more mature
- backups are no longer restricted to a manual-only mindset
- increased confidence in long-term operations due to better runtime visibility

### Release narrative
"Mihombreng now has a stronger safety net for config changes and long-term runtime operations."

### Exit criteria
- backup policy becomes usable
- retention model is clear
- remote target story is minimally established or explicitly deferred

---

## Sprint 5 -> Release Train R5

### Theme
Secure and external-ready panel.

### Planned focus
- M7.1 — Auth and session model
- M7.2 — Auditability and reliability hardening

### Release outcome
- the panel is no longer assumed to be for trusted LANs only
- sensitive actions begin to have auditability
- session/auth failures begin to be handled correctly

### Release narrative
"Mihombreng is now ready for deployment in broader environments and is operationally more secure."

### Exit criteria
- login/logout/session expiry flows are usable
- protected API/stream access is consistent
- baseline audit/logging is adequate

---

## Sprint 6 -> Release Train R6

### Theme
Advanced routing and distribution maturity.

### Planned focus
- M8.1 — Routing mode orchestration
- M8.2 — Packaging and OpenWrt maturity

### Release outcome
- routing modes can be managed more securely from the UI
- deployment/upgrade stories are cleaner on both Linux and OpenWrt

### Release narrative
"Mihombreng is now not just an observability/config panel, but also a more mature control panel for routing and distribution."

### Exit criteria
- mode apply/rollback/recovery flows are viable for use
- packaging/deploy guidance is reasonably consistent
- diagnostics support routing mode troubleshooting

---

## Release Bundles vs Milestones

| Release | Milestones Included | Notes |
|---------|---------------------|-------|
| R1 | M1 + partial M2 | low-risk, fast operator value |
| R2 | M2 + M3 | config/provider maturity release |
| R3 | M4 + partial M5 | product-defining release |
| R4 | M5 + M6 | runtime insight + safety net |
| R5 | M7 | security/hardening release |
| R6 | M8 | advanced routing/distribution release |

---

## Optional Alternate Release Strategy

If security requirements suddenly become critical, the order can be adjusted:

### Security-first alternative
- R1 = M1 + M2.2
- R2 = M3 + M7.1
- R3 = M7.2 + partial M2.1
- R4 = M4 + M5
- R5 = M6
- R6 = M8

Use this path if:
- the panel will be exposed to wider networks earlier
- authentication becomes an urgent need before major subscription features

---

## Release Readiness Checklist

Before marking a release train as ready, verify at least the following:

- [ ] clear operator story
- [ ] release scope does not mix too many risk classes
- [ ] primary hard dependencies are met
- [ ] milestone tracker is updated
- [ ] gap audit for the release area has been re-reviewed
- [ ] items out-of-scope for the subsequent release remain separated

---

## Current Recommended Path

Currently, the most logical path remains:

1. `R1` — observability and recovery basics
2. `R2` — safer config and provider operations
3. `R3` — subscription-centric control plane
4. `R4` — runtime insight and safety net
5. `R5` — secure and external-ready panel
6. `R6` — advanced routing and distribution

Reasons:
- delivers rapid value to operators early on
- reinforces safety/configs before tackling the large subscription domain
- defers highest risk classes until observability and foundational workflows are mature

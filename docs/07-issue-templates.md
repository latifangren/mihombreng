# Issue Templates

This document provides issue planning templates for milestones and implementation sub-issues derived from [`06-implementation-plan.md`](06-implementation-plan.md).

The goal is not to replace the issue tracker, but to provide a consistent format for when the actual issues are created.

---

## How to Use

- Use the **Milestone Template** for parent / umbrella issues
- Use the **Implementation Issue Template** for concrete implementation tasks such as `M1.1`, `M2.2`, etc.
- Fill out the `Out of scope` section firmly to prevent scope creep
- Reference `05-roadmap.md` and `06-implementation-plan.md` where appropriate

---

## Milestone Template

```md
# <Milestone ID> — <Milestone Name>

## Objective
<briefly: why this milestone is important>

## Background
- roadmap reference: `docs/05-roadmap.md`
- implementation reference: `docs/06-implementation-plan.md`

## In Scope
- <item 1>
- <item 2>
- <item 3>

## Out of Scope
- <intentionally excluded items>
- <deferred follow-up items>

## Child Issues
- [ ] <Issue A>
- [ ] <Issue B>
- [ ] <Issue C>

## Success Criteria
- [ ] <outcome 1>
- [ ] <outcome 2>
- [ ] <outcome 3>

## Risks / Notes
- <risk 1>
- <compatibility note>
```

---

## Implementation Issue Template

```md
# <Issue ID> — <Issue Name>

## Objective
<what should be improved after this issue is resolved>

## Background
- roadmap reference: `docs/05-roadmap.md`
- implementation reference: `docs/06-implementation-plan.md`
- related milestone: `<Milestone ID>`

## Affected Modules
### Backend
- `<backend module path>`
- `<backend module path>`

### Frontend
- `<frontend module path>`
- `<frontend module path>`

## Scope
- <scope item 1>
- <scope item 2>
- <scope item 3>

## API Changes
- [ ] none
- [ ] new endpoint
- [ ] response shape modification
- [ ] new validation contract

Details:
- <explain if applicable>

## UI / UX Changes
- [ ] none
- [ ] new page
- [ ] new panel / section
- [ ] existing workflow refinement

Details:
- <explain if applicable>

## Compatibility Notes
- <backward compatibility expectations>
- <migration concerns if any>

## Out of Scope
- <items intentionally excluded from this issue>
- <separated follow-up items>

## Definition of Done
- [ ] <outcome 1>
- [ ] <outcome 2>
- [ ] <outcome 3>

## Verification
- [ ] doc / contract review
- [ ] backend behavior verified
- [ ] frontend flow verified
- [ ] edge-cases reviewed
```

---

## Pre-filled Milestone Parent Templates

### M1 — Logs and Diagnostics Baseline

```md
# M1 — Logs and Diagnostics Baseline

## Objective
Quickly elevate observability quality without significantly modifying the backend architecture.

## Background
- roadmap reference: `docs/05-roadmap.md`
- implementation reference: `docs/06-implementation-plan.md`

## In Scope
- stabilize log stream contract
- logs UX maturity
- diagnostics page v1

## Out of Scope
- auth/session layer
- routing mode orchestration
- subscription workspace

## Child Issues
- [x] M1.1 — Stabilize log UX and stream contract
- [x] M1.2 — Diagnostics page v1

## Success Criteria
- [x] admins can read logs more comfortably
- [x] admins can perform basic health checks without SSH
- [x] diagnostic results can be used for support/debugging
```

### M2 — Provider and Backup Operations

```md
# M2 — Provider and Backup Operations

## Objective
Make daily provider and backup operations more secure and operational.

## Child Issues
- [x] M2.1 — Dedicated provider operations UI
- [x] M2.2 — Backup history and restore workspace
```

### M3 — Config Editor Maturity

```md
# M3 — Config Editor Maturity

## Objective
Make the config editor safe for production changes.

## Child Issues
- [x] M3.1 — Config validation pipeline
- [x] M3.2 — Editor workflow polish
```

### M4 — Profiles / Subscriptions Workspace

```md
# M4 — Profiles / Subscriptions Workspace

## Objective
Establish subscriptions as a core feature, rather than just an input converter or manual file generation.

## Child Issues
- [x] M4.1 — Subscription domain model and API
- [x] M4.2 — Profiles UI workspace
```

### M5 — Traffic and Connections Workspace

```md
# M5 — Traffic and Connections Workspace

## Objective
Provide deeper runtime visibility for debugging and tuning.

## Child Issues
- [x] M5.1 — Traffic metrics v2
- [x] M5.2 — Connections workspace
```

### M6 — Backup Safety and Restore Policies

```md
# M6 — Backup Safety and Restore Policies

## Objective
Ensure that major config changes always have a rapid recovery path.

## Child Issues
- [x] M6.1 — Backup automation and retention
- [x] M6.2 — Remote backup targets
```

### M7 — Auth, Audit, Hardening

```md
# M7 — Auth, Audit, Hardening

## Objective
Make mihombreng robust enough for deployment across environments beyond a trusted LAN.

## Child Issues
- [x] M7.1 — Auth and session model
- [x] M7.2 — Auditability and reliability hardening
```

### M8.1 — Routing Mode Orchestration

```md
# M8.1 — Routing Mode Orchestration

## Objective
Finalize network mode controls without compromising the current safety baseline.

## Child Issues
- [ ] M8.1 — Routing mode orchestration
```

### M8.2 — Packaging and OpenWrt Distribution Maturity

```md
# M8.2 — Packaging and OpenWrt Distribution Maturity

## Objective
Mature the OpenWrt/Linux packaging and CI/CD distribution pipeline.

## Child Issues
- [x] M8.2 — Packaging and OpenWrt maturity
```

---

## Pre-filled Implementation Issue Titles

Use the following titles to maintain consistency:

- `M1.1 — Stabilize log UX and stream contract`
- `M1.2 — Diagnostics page v1`
- `M2.1 — Dedicated provider operations UI`
- `M2.2 — Backup history and restore workspace`
- `M3.1 — Config validation pipeline`
- `M3.2 — Editor workflow polish`
- `M4.1 — Subscription domain model and API`
- `M4.2 — Profiles UI workspace`
- `M5.1 — Traffic metrics v2`
- `M5.2 — Connections workspace`
- `M6.1 — Backup automation and retention`
- `M6.2 — Remote backup targets`
- `M7.1 — Auth and session model`
- `M7.2 — Auditability and reliability hardening`
- `M8.1 — Routing mode orchestration`
- `M8.2 — Packaging and OpenWrt maturity`
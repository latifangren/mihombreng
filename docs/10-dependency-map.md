# Dependency Map

This document maps dependencies between milestones and implementation issues.

Its purpose:

- show a safe work order
- reduce the risk of working on an issue that ends up waiting for other contracts
- help separate dependencies into **hard**, **soft**, and **parallelizable**

References:
- [`06-implementation-plan.md`](06-implementation-plan.md)
- [`08-milestone-tracker.md`](08-milestone-tracker.md)
- [`09-roadmap-gap-audit.md`](09-roadmap-gap-audit.md)

This document remains **planning-only**.

---

## Dependency Legend

### Hard dependency
The issue or milestone **should not be worked on fully** before this dependency is available, as the main blocker lies in the contract, data shape, or safety model.

### Soft dependency
The issue can be partially started, but the final outcome will be safer / faster if this dependency is already present.

### Parallelizable
Issues can run in parallel since they don't directly block each other, or only need minor synchronization at the end.

---

## Milestone Dependency Graph

### High-level chain

```text
M1 ┬─ ┬─┐
   │  └─> M5 ┬─ ┬─┐
M2 ┼─ ┬─┐    │  │ │
   │  │ └─> M4 ─┤ │
M3 ┴─ │ └─┐  │  │ │
      │   │  │  │ └─> M7 ┬─ ┬─┐
      │   │  │  └───────> │  │ │
      │   └──> M6 ─────> M8.2 │
      └─────────────────────> M8.1
```

### Explanation
- `M1` reinforces observability and diagnostics, aiding debugging of other milestones
- `M2` and `M3` close operational baseline gaps before entering larger domains
- `M5` enriches runtime observability and assists in designing `M4` and `M8`
- `M4` requires a new domain model and is aided by config/runtime clarity from `M3` and `M5`
- `M6` stands quite independently, but is safer once baseline backup workflows mature from `M2`
- `M7` does not strictly have to wait for everything else, but practically is more stable once core workflows are clearer
- `M8` is the riskiest and safest to work on after observability and runtime contracts are more mature

---

## Milestone Dependency Matrix

| Milestone | Hard Depends On | Soft Depends On | Parallelizable With |
|-----------|-----------------|-----------------|---------------------|
| M1 — Logs and Diagnostics Baseline | none | none | M2, M3 |
| M2 — Provider and Backup Operations | none | M3 | M1, M3 |
| M3 — Config Editor Maturity | none | M2 | M1, M2 |
| M4 — Profiles / Subscriptions Workspace | none strictly, but backend model required internally | M3, M5 | M6 after model stabilizes |
| M5 — Traffic and Connections Workspace | none | M1 | M3, partial M4 |
| M6 — Backup Safety and Restore Policies | none strictly | M2, M3 | M4, M5 |
| M8.2 — Packaging and OpenWrt Distribution Maturity | none strictly | deploy/docs/build plumbing | can run beside M6 and independent of M7 |
| M7 — Auth, Audit, Hardening | none strictly | M1, M4, M5 | partial M6 |
| M8.1 — Routing Mode Orchestration | none strictly | M1, M5, partial M7 | after packaging lane or independent if runtime need appears |

---

## Issue-to-Issue Dependencies

### M1 — Logs and Diagnostics Baseline

#### M1.1 — Stabilize log UX and stream contract
- **Hard depends on:** none
- **Soft depends on:** none
- **Unlocks:** M5.2, M8.1 troubleshooting quality, M7 audit UX assumptions

#### M1.2 — Diagnostics page v1
- **Hard depends on:** minimal diagnostics result shape
- **Soft depends on:** M1.1 if consistent observability vocabulary is desired
- **Unlocks:** M8.1 safer rollout, M7 ops readiness, support workflows

---

### M2 — Provider and Backup Operations

#### M2.1 — Dedicated provider operations UI
- **Hard depends on:** minimal provider metadata contract
- **Soft depends on:** M3.1 when provider validation is included
- **Unlocks:** M4.2 workflow consistency, M6 operational backup confidence

#### M2.2 — Backup history and restore workspace
- **Hard depends on:** backup list metadata + minimal history actions
- **Soft depends on:** M6.1 if immediately merging retention awareness
- **Unlocks:** M6.1 / M6.2 UX continuity

---

### M3 — Config Editor Maturity

#### M3.1 — Config validation pipeline
- **Hard depends on:** validate/lint API contract
- **Soft depends on:** none
- **Unlocks:** M3.2, M4.1 safety assumptions, M8.1 safer apply workflows

#### M3.2 — Editor workflow polish
- **Hard depends on:** M3.1 for a mature validate flow
- **Soft depends on:** M2.1 if provider/editor consistency is desired
- **Unlocks:** M4.2 consistency, operator trust in config workflows

---

### M4 — Profiles / Subscriptions Workspace

#### M4.1 — Subscription domain model and API
- **Hard depends on:** internal entity/lifecycle agreement
- **Soft depends on:** M3.1, M5.2
- **Unlocks:** M4.2, partial M7 auth scoping, future automation

#### M4.2 — Profiles UI workspace
- **Hard depends on:** M4.1
- **Soft depends on:** M2.1, M3.2
- **Unlocks:** provider/subscription-led release narrative

---

### M5 — Traffic and Connections Workspace

#### M5.1 — Traffic metrics v2
- **Hard depends on:** richer metrics contract
- **Soft depends on:** M1.1
- **Unlocks:** release-level observability confidence, M8 runtime verification

#### M5.2 — Connections workspace
- **Hard depends on:** richer connection payload contract
- **Soft depends on:** M1.1, M1.2
- **Unlocks:** M4 operator context, M8 troubleshooting, future audit views

---

### M6 — Backup Safety and Restore Policies

#### M6.1 — Backup automation and retention
- **Hard depends on:** policy model for trigger/retention
- **Soft depends on:** M2.2, M3.1
- **Unlocks:** M6.2 and a safer release train

#### M6.2 — Remote backup targets
- **Hard depends on:** M6.1 abstraction direction
- **Soft depends on:** M2.2
- **Unlocks:** production-grade backup story

---

### M7 — Auth, Audit, Hardening

#### M7.1 — Auth and session model
- **Hard depends on:** auth architecture decision
- **Soft depends on:** M4.1, M5.2
- **Unlocks:** M7.2, safer external exposure, M8 UI safety gating

#### M7.2 — Auditability and reliability hardening
- **Hard depends on:** M7.1 if audit logs are tied to user/session identity
- **Soft depends on:** M1.2, M5.2
- **Unlocks:** enterprise-readiness, post-action traceability

---

### M8 — Split Status

#### M8.1 — Routing mode orchestration
- **Hard depends on:** routing contract, host capability model, apply/rollback semantics
- **Soft depends on:** M1.2, M3.1, M5.1, M5.2, optional M7.1
- **Unlocks:** advanced runtime/network control release

#### M8.2 — Packaging and OpenWrt maturity
- **Hard depends on:** packaging direction agreement
- **Soft depends on:** deploy/docs/build plumbing, optional M6.1 for a nicer operational story
- **Unlocks:** cleaner deploy/upgrade story, OpenWrt distribution baseline, CI-backed install paths

---

## Recommended Execution Bundles

### Bundle A — low-risk operator value
- M1.1
- M1.2
- M2.2

### Bundle B — safer config and provider workflows
- M2.1
- M3.1
- M3.2

### Bundle C — richer runtime visibility
- M5.1
- M5.2

### Bundle D — product-defining subscription workspace
- M4.1
- M4.2

### Bundle E — production safety net
- M6.1
- M6.2
- M7.1
- M7.2

### Bundle F — advanced routing and distribution
- M8.1
- M8.2

---

## Key Planning Notes

- **M3.1** is one of the most critical dependencies because the validation contract assists many other workflows
- **M4.1** is a domain pivot for subscription-centric features
- **M7.1** is a security pivot; don't delay it too long if the panel starts being used on wider networks
- **M8.1** is a runtime-risk pivot; observability and validation should be mature first
- `none strictly` on some milestones does not mean they can be done in any random order; it simply means theoretically no absolute blockers, but there is still a practically safer sequence

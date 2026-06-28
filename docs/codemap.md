# docs/

## Responsibility
Project-level documentation covering system architecture, REST/WebSocket API specification, frontend design system, installation/deployment procedures, product roadmap, implementation planning, milestone tracking, gap auditing, dependency mapping, release planning, and reusable issue-planning templates. Serves as the single source of truth for developer onboarding, API consumers, and deployment operators.

## Design
Numbered markdown files follow a progressive disclosure pattern:

1. architecture
2. API
3. frontend
4. installation / deployment
5. roadmap (strategic)
6. implementation plan (execution)
7. issue templates (issue authoring)
8. milestone tracker (status tracking)
9. roadmap gap audit (API/UI gap analysis)
10. dependency map (cross-milestone planning)
11. release plan (sprint/release planning)

`README.md` acts as a table of contents linking to each document. Documentation is hand-written (not auto-generated) and covers both the Go backend and React frontend stacks. API reference uses endpoint tables with request/response JSON examples. Architecture document enforces dependency direction rules between layers. Planning documents separate **product direction**, **execution plan**, **issue authoring**, **real progress tracking**, **gap analysis**, **dependency mapping**, and **release planning** so each planning concern stays focused.

### Documents

| File | Scope |
|------|-------|
| `README.md` | Index / table of contents |
| `01-architecture.md` | System topology, request flow, layer responsibilities, dependency rules |
| `02-api-reference.md` | Full REST + WebSocket API spec (App, Mihomo control, Config files, DNS, Converter, Backup) |
| `03-frontend.md` | React/TypeScript stack, retro-brutalist design system, component catalog, dev workflow |
| `04-installation.md` | Build instructions, environment variables, systemd/procd service setup |
| `05-roadmap.md` | Strategic roadmap: current state, product direction, priority waves, sprint priorities, milestone summary |
| `06-implementation-plan.md` | Execution-oriented plan: milestone order, status matrix, issue breakdown, affected modules, definitions of done |
| `07-issue-templates.md` | Reusable templates for milestone parent issues and implementation issues |
| `08-milestone-tracker.md` | Real progress tracker: status, readiness, blockers, next actions per milestone |
| `09-roadmap-gap-audit.md` | Audit map from roadmap areas to API gaps, UI gaps, and recommended execution shape |
| `10-dependency-map.md` | Hard/soft/parallel dependency map across milestones and issue bundles |
| `11-release-plan.md` | Sprint-to-release mapping, release trains, release themes, and release exit criteria |

## Flow
```
Developer/operator
  └── README.md (index)
        ├── 01-architecture.md
        │     ├── Layer diagram: Browser -> Go Gin -> handler -> service -> domain
        │     ├── Responsibility split table
        │     └── Dependency direction rules (forbidden circular imports)
        ├── 02-api-reference.md
        │     ├── Base: http://<host>:7777/api/v1/*
        │     ├── Endpoints: App, Mihomo, Config files, DNS, Converter, Backup
        │     └── WebSocket streams: logs, memory, traffic, connections
        ├── 03-frontend.md
        │     ├── Stack: React 19, Vite 7, TypeScript 5.9, Tailwind v4
        │     ├── Design system: dark retro-brutalist, monospace, 3D buttons
        │     └── Component tree: ui/, layout/, dashboard/, mihomo/, config/, ...
        ├── 04-installation.md
        │     ├── Build: go build + npm build + air (live reload)
        │     ├── Env vars: MIHOMBRENG_ADDR, MIHOMBRENG_CONFIG, MIHOMBRENG_DEBUG
        │     └── Services: procd (OpenWrt), systemd (Linux)
        ├── 05-roadmap.md
        │     ├── Current status snapshot
        │     ├── Product direction summary
        │     ├── Priority waves
        │     ├── Sprint priorities
        │     └── Milestone summary
        ├── 06-implementation-plan.md
        │     ├── Planning rules (backend-first / frontend-first / vertical-slice)
        │     ├── Milestone status matrix
        │     ├── Issue breakdown by milestone
        │     └── Definition of done per issue
        ├── 07-issue-templates.md
        │     ├── Milestone issue template
        │     ├── Implementation issue template
        │     └── Pre-filled milestone title/template helpers
        ├── 08-milestone-tracker.md
        │     ├── Tracker summary table
        │     ├── Status / readiness / blockers
        │     └── Next-action guidance
        ├── 09-roadmap-gap-audit.md
        │     ├── Area-by-area API gap audit
        │     ├── Area-by-area UI gap audit
        │     └── Backend-first / frontend-first / vertical-slice recommendation
        ├── 10-dependency-map.md
        │     ├── Milestone dependency graph
        │     ├── Issue-to-issue dependency map
        │     └── Recommended execution bundles
        └── 11-release-plan.md
              ├── Sprint-to-release mapping
              ├── Release train themes
              ├── Exit criteria
              └── Alternate release strategy
```

## Integration
- **Backend docs**: `backend/docs/` contains auto-generated Swagger specs (complements hand-written API reference)
- **Source code**: Architecture document describes `cmd/server`, `internal/http/handler`, `internal/service`, `internal/domain`, `pkg/config`, `pkg/logger`
- **Deployment**: `04-installation.md` references `deploy/systemd/` and `deploy/docker/` patterns
- **Frontend**: `03-frontend.md` documents `web/` directory structure and component hierarchy
- **Planning stack**:
  - `05-roadmap.md` = strategy / product direction
  - `06-implementation-plan.md` = execution plan
  - `07-issue-templates.md` = issue authoring
  - `08-milestone-tracker.md` = live planning status
  - `09-roadmap-gap-audit.md` = API/UI gap analysis
  - `10-dependency-map.md` = dependency planning
  - `11-release-plan.md` = release train planning

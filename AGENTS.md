## First reads
- Read `codemap.md` at repo root before touching code. For deep work, also read folder codemaps such as `backend/cmd/server/codemap.md`, `backend/internal/http/codemap.md`, and `backend/internal/service/codemap.md`.
- This repo now has a `.codegraph/` index. Prefer `codegraph_explore` first for architecture, symbol flow, and call-path questions; use `read`/`grep` after that for exact local context.

## Repo shape that matters
- `backend/` is the real app: Go API + embedded SPA. Entrypoint: `backend/cmd/server/main.go`.
- `web/` is the standalone Vite/React source, but production UI is served from `backend/internal/ui/dist` after embed/copy during backend build.
- `defaults/mihombreng.yaml` is the default local config and also packaging seed data.
- Root `Makefile` is for packaging/release targets; day-to-day app build logic lives in `backend/Makefile`.

## Exact commands agents should not guess
- Frontend-only verification:
  - `cd web && npm run lint`
  - `cd web && npm run build`
- Focused backend verification for non-routing code:
  - `cd backend && go test ./internal/<package>`
- Full backend build with embedded UI:
  - `cd backend && make build`
  - This runs, in order: frontend build -> `swag init` -> copy `web/dist` into `backend/internal/ui/dist` -> Go build.
- Local run:
  - `cd backend && ./bin/mihombreng -c ../defaults/mihombreng.yaml`
- Linux redeploy flow from README:
  - `cd /home/<user>/GITHUB/mihombreng/backend && make build`
  - `sudo install -m 755 bin/mihombreng /usr/share/mihombreng/mihombreng`
  - `sudo systemctl restart mihombreng`
- Post-redeploy checks:
  - `curl -i http://127.0.0.1:7777/api/v1/mihomo/api/version`
  - `curl http://127.0.0.1:7777/api/v1/mihomo/status`

## Verification order
- For UI/API changes, prefer: `cd web && npm run lint` -> `cd web && npm run build` -> targeted backend test/build only for touched backend code.
- Use full `cd backend && make build` only when changes affect embedded UI, Swagger docs, packaging, or the final binary assembly.

## Routing / platform gotchas
- Routing code under `backend/internal/service/routing/*` is Linux-specific (`netlink`, `unix`, nftables). Windows editors/LSP may show false undefined-symbol noise there.
- If you touch routing code, validate with a Linux-targeted build like CI instead of trusting Windows diagnostics:
  - `cd backend && GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o /dev/null ./cmd/server`
- Do not treat Windows LSP errors in routing files as proof of a production regression.

## Build / toolchain quirks
- `backend make build` requires `swag` on PATH because it runs `swag init -g cmd/server/main.go -o docs`.
- Backend build copies `web/dist` into `backend/internal/ui/dist`; avoid rebuilding frontend when you only changed backend logic.
- CI uses Go 1.24 and Node 20. `backend/go.mod` says Go 1.23.12; prefer CI versions when validating cross-platform or release issues.

## Preferred skills / MCP for this repo
- Use `codegraph_explore` first for "where does this flow go?" or symbol-impact questions now that the repo is indexed.
- For deployed UI bugs, do not guess from source first:
  - use `chrome-devtools` first for Network payload/response, Console, and quick DOM state
  - use `playwright` / skill `webapp-testing` / skill `browse` for longer user flows or repeatable QA
- Avoid regenerating codemaps with the `codemap` skill unless the repo docs are clearly stale; this repo already ships curated codemaps.

## High-signal conventions from recent work


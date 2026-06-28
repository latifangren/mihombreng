# internal/ui/

## Responsibility
Embeds the pre-built frontend SPA (Vue/React) into the Go binary at compile time using Go's `embed` directive. Provides a single `GetStaticFS()` function that returns an `fs.FS` rooted at the `dist/` subdirectory, enabling the Go server to serve the frontend without external file dependencies.

## Design
- **Go embed**: `//go:embed dist/*` directive captures all files under `internal/ui/dist/` into `staticFiles embed.FS` at compile time.
- **Sub-filesystem extraction**: `fs.Sub(staticFiles, "dist")` returns an `fs.FS` with paths rooted at `dist/`, so consumers reference `index.html` rather than `dist/index.html`.
- **Minimal surface**: Single exported function `GetStaticFS() (fs.FS, error)`. No error paths in current implementation (always returns nil error).

## Flow
```
Compile time: go embed captures dist/* → staticFiles embed.FS

Runtime:
  cmd/server/main.go
    → ui.GetStaticFS()
      → fs.Sub(staticFiles, "dist")
        → returns fs.FS
          → served via http.FS() for static assets
          → index.html read and served at "/" and NoRoute fallback
```

## Integration
| Dependency | Direction | Purpose |
|---|---|---|
| `cmd/server/main.go` | consumed by | Mounts static FS for SPA serving at `/`, `/assets/*`, `/favicon.svg` |
| `internal/ui/dist/` | embeds | Pre-built frontend assets (compiled into binary) |

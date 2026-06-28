# scripts/

## Responsibility
Build automation script for producing release-ready Mihombreng binaries across 13 target platforms. Orchestrates the full build pipeline: frontend compilation, Go module preparation, Swagger documentation generation, static asset embedding, and cross-compilation for Linux (amd64, arm64, 386, arm, mips variants, riscv64, ppc64/s390x) and Android (arm64).

## Design
Single bash script (`build.sh`) using `set -e` for fail-fast error handling. Follows a 5-stage sequential pipeline with numbered progress indicators. Uses POSIX-compatible shell constructs for portability. Cross-compilation is driven by a `platforms` array with `GOOS/GOARCH` pairs. Special handling for ARM variants (ARMv5/v6/v7 sub-builds) and MIPS soft-float mode (`GOMIPS=softfloat`). All builds use `CGO_ENABLED=0` for static binaries and `-ldflags="-s -w"` for symbol stripping. `GIN_MODE=release` disables Gin debug logging.

## Flow
```
build.sh
  ├── [1/5] Frontend build
  │     └── web/ -> npm install -> npm run build -> web/dist/
  ├── [2/5] Go module tidy
  │     └── backend/ -> go mod tidy
  ├── [3/5] Swagger generation
  │     └── backend/ -> swag init -g cmd/server/main.go -o docs
  ├── [4/5] Static file embedding
  │     └── web/dist/ -> backend/internal/ui/dist/
  └── [5/5] Multi-arch Go binary build
        └── backend/ -> go build ./cmd/server
              ├── linux/amd64      -> bin/mihombreng-linux-amd64
              ├── linux/arm64      -> bin/mihombreng-linux-arm64
              ├── linux/arm        -> bin/mihombreng-linux-arm{v5,v6,v7}
              ├── linux/386        -> bin/mihombreng-linux-386
              ├── linux/mips       -> bin/mihombreng-linux-mips (softfloat)
              ├── linux/mipsle     -> bin/mihombreng-linux-mipsle (softfloat)
              ├── linux/mips64     -> bin/mihombreng-linux-mips64
              ├── linux/mips64le   -> bin/mihombreng-linux-mips64le
              ├── linux/riscv64    -> bin/mihombreng-linux-riscv64
              ├── linux/ppc64      -> bin/mihombreng-linux-ppc64
              ├── linux/ppc64le    -> bin/mihombreng-linux-ppc64le
              ├── linux/s390x      -> bin/mihombreng-linux-s390x
              └── android/arm64    -> bin/mihombreng-android-arm64
```

## Integration
- **Prerequisites**: Node.js 18+ (npm), Go 1.22+, swag CLI (`go install github.com/swaggo/swag/cmd/swag@latest`)
- **Input**: `web/` (React/Vite frontend), `backend/` (Go source with `cmd/server` entrypoint)
- **Output**: `backend/bin/mihombreng-{os}-{arch}` binaries
- **Swagger**: Generates `backend/docs/docs.go`, `swagger.json`, `swagger.yaml` from Go annotations
- **Embedding**: Copies `web/dist/` to `backend/internal/ui/dist/` for Go `//go:embed` inclusion
- **Docker**: Dockerfile builds independently (does not use this script)
- **CI/CD**: Intended for GitHub Actions or manual release builds

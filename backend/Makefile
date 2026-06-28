.PHONY: build dev docs clean help deps install-air setup-dev

help:
	@echo "Mihombreng - Backend API for mihomo tunneling"
	@echo ""
	@echo "Available commands:"
	@echo "  build        - Build with embedded dashboard (single binary)"
	@echo "  dev          - Run development server with hot reload (air)"
	@echo "  docs         - Generate swagger documentation"
	@echo "  clean        - Remove build artifacts, docs, and frontend build"
	@echo "  deps         - Install Go dependencies"
	@echo "  install-air  - Install air for hot reload development"
	@echo "  setup-dev    - Full development environment setup"
	@echo "  help         - Show this help message"
	@echo ""
	@echo "Usage examples:"
	@echo "  make build              # Build single binary with embedded dashboard"
	@echo "  make dev                # Development with hot reload (default config)"
	@echo "  ./bin/mihombreng -c /path/to/config.yaml  # Production with custom config"
	@echo "  ./bin/mihombreng -config /etc/mihombreng/mihombreng.yaml  # Production with config"
	@echo "  make docs               # Generate API documentation"
	@echo "  make clean && make build # Clean build"

build:
	@echo "=== Building Mihombreng (Development) ==="
	@echo "[1/4] Building frontend..."
	@cd ../web && npm install && npm run build
	@echo "[2/4] Generating Swagger docs..."
	@swag init -g cmd/server/main.go -o docs
	@echo "[3/4] Preparing static files..."
	@rm -rf internal/ui/dist
	@cp -r ../web/dist internal/ui/dist
	@chmod -R 755 internal/ui/dist
	@echo "[4/4] Building Go binary with embedded dashboard..."
	@mkdir -p bin
	@mkdir -p $(HOME)/.tmp
	@env GIN_MODE=release CGO_ENABLED=0 GOCACHE=$(HOME)/.cache/go-build GOTMPDIR=$(HOME)/.tmp \
		go build -ldflags="-s -w" -o bin/mihombreng ./cmd/server
	@echo ""
	@echo "Build complete! Binary: bin/mihombreng"

dev:
	@echo "Starting development server with hot reload..."
	air

docs:
	@echo "Generating swagger documentation..."
	~/go/bin/swag init -g cmd/server/main.go

clean:
	@echo "Cleaning..."
	rm -rf bin/
	rm -rf docs/
	rm -rf internal/ui/dist
	rm -rf ../web/dist
	rm -rf ../web/node_modules

deps:
	@echo "Installing dependencies..."
	go mod tidy
	go mod download

install-air:
	@echo "Installing air for hot reload..."
	go install github.com/cosmtrek/air@latest

setup-dev: install-air deps
	@echo "Development environment setup complete!"
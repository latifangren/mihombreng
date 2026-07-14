#!/bin/bash
# Build script for OpenWrt packages
# Reuses main Makefile targets for consistency

set -euo pipefail

# ── Parameters ──────────────────────────────────────────────

ARCH=""
BUILD_DIR=""
MIHOMO_VERSION="v1.19.28"
MIHOMO_ARCH=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --arch=*)        ARCH="${1#*=}" ;;
    --build-dir=*)   BUILD_DIR="${1#*=}" ;;
    --mihomo-version=*) MIHOMO_VERSION="${1#*=}" ;;
    --mihomo-arch=*) MIHOMO_ARCH="${1#*=}" ;;
    *)               echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

# ── Validate ────────────────────────────────────────────────

if [[ -z "$ARCH" || -z "$BUILD_DIR" ]]; then
  echo "Usage: $0 --arch=<arch> --build-dir=<dir> [--mihomo-version=<ver>] [--mihomo-arch=<arch>]"
  exit 1
fi

echo "Building for arch: $ARCH"
echo "Build directory: $BUILD_DIR"
echo "Mihomo version: $MIHOMO_VERSION"

# ── Build Frontend ──────────────────────────────────────────

echo "[1/6] Building frontend..."
cd web
npm install
npm run build
cd ..

# ── Generate Swagger ────────────────────────────────────────

echo "[2/6] Generating Swagger docs..."
cd backend
export PATH="$HOME/go/bin:$PATH"
swag init -g cmd/server/main.go -o docs
cd ..

# ── Prepare Static Files ───────────────────────────────────

echo "[3/6] Preparing static files..."
rm -rf backend/internal/ui/dist
cp -r web/dist backend/internal/ui/dist
chmod -R 755 backend/internal/ui/dist

# ── Cross-compile Go Binary ─────────────────────────────────

echo "[4/6] Compiling Go binary..."
cd backend
mkdir -p bin

GOARCH_MAP=(
  "arm:arm"
  "aarch64:arm64"
  "mips:mips"
  "mipsel:mipsle"
  "x86_64:amd64"
)

TARGET_GOARCH=""
for mapping in "${GOARCH_MAP[@]}"; do
  if [[ "$ARCH" == "${mapping%%:*}" ]]; then
    TARGET_GOARCH="${mapping##*:}"
    break
  fi
done

if [[ -z "$TARGET_GOARCH" ]]; then
  echo "Unsupported architecture: $ARCH"
  exit 1
fi

GOOS=linux \
GOARCH=$TARGET_GOARCH \
CGO_ENABLED=0 \
go build -v -trimpath -ldflags="-s -w" -o bin/mihombreng ../cmd/server

cd ..

# ── Download Mihomo ─────────────────────────────────────────

echo "[5/6] Downloading Mihomo $MIHOMO_VERSION..."
wget -q -O "$BUILD_DIR/mihomo.gz" \
  "https://github.com/MetaCubeX/mihomo/releases/download/$MIHOMO_VERSION/mihomo-linux-$MIHOMO_ARCH-$MIHOMO_VERSION.gz"
gunzip -f "$BUILD_DIR/mihomo.gz"
chmod +x "$BUILD_DIR/mihomo"

# ── Download Assets ─────────────────────────────────────────

echo "[6/6] Downloading assets..."
# GeoIP
wget -q -O "$BUILD_DIR/country.mmdb" https://github.com/MetaCubeX/meta-rules-dat/releases/latest/download/country.mmdb
wget -q -O "$BUILD_DIR/geoip.dat" https://github.com/MetaCubeX/meta-rules-dat/releases/latest/download/geoip.dat
wget -q -O "$BUILD_DIR/geosite.dat" https://github.com/MetaCubeX/meta-rules-dat/releases/latest/download/geosite.dat
wget -q -O "$BUILD_DIR/geoip.metadb" https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.metadb

# UI Assets
curl -sL -o "$BUILD_DIR/zashboard.zip" "https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip"
mkdir -p "$BUILD_DIR/ui/zashboard"
unzip -q "$BUILD_DIR/zashboard.zip" -d "$BUILD_DIR/temp_zashboard"
mv "$BUILD_DIR/temp_zashboard/dist/"* "$BUILD_DIR/ui/zashboard/"
rm -rf "$BUILD_DIR/temp_zashboard" "$BUILD_DIR/zashboard.zip"

curl -sL -o "$BUILD_DIR/metacubexd.tgz" "https://github.com/MetaCubeX/metacubexd/releases/latest/download/compressed-dist.tgz"
mkdir -p "$BUILD_DIR/ui/metacubexd"
tar -xzf "$BUILD_DIR/metacubexd.tgz" -C "$BUILD_DIR/ui/metacubexd"
rm "$BUILD_DIR/metacubexd.tgz"

echo "Build complete!"

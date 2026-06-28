#!/bin/bash
set -e

echo "=== Building Mihombreng ==="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "[1/5] Building frontend..."
cd "$PROJECT_ROOT/web"
npm install
npm run build

echo "[2/5] Tiding Go modules..."
cd "$PROJECT_ROOT/backend"
go mod tidy

echo "[3/5] Generating Swagger docs..."
export PATH=$HOME/go/bin:$PATH
cd "$PROJECT_ROOT/backend"
swag init -g cmd/server/main.go -o docs

echo "[4/5] Preparing static files..."
cd "$PROJECT_ROOT/backend"
rm -rf internal/ui/dist
cp -r "$PROJECT_ROOT/web/dist" internal/ui/dist
chmod -R 755 internal/ui/dist

echo "[5/5] Building Go binary (Multi-Arch)..."

platforms=(
    "linux/amd64"
    "linux/arm64"
    "linux/386"
    "linux/arm"
    "linux/mips"
    "linux/mipsle"
    "linux/mips64"
    "linux/mips64le"
    "linux/riscv64"
    "linux/ppc64"
    "linux/ppc64le"
    "linux/s390x"
    "android/arm64"
)

cd "$PROJECT_ROOT/backend"
mkdir -p bin

for platform in "${platforms[@]}"; do
    platform_split=(${platform//\// })
    GOOS=${platform_split[0]}
    GOARCH=${platform_split[1]}
    output_name="bin/mihombreng-$GOOS-$GOARCH"
    
    if [ "$GOARCH" == "arm" ]; then
        echo " -> Building for $GOOS/$GOARCH (ARMv5)..."
        env GIN_MODE=release CGO_ENABLED=0 GOOS=$GOOS GOARCH=$GOARCH GOARM=5 \
            go build -ldflags="-s -w" -o "${output_name}v5" ./cmd/server

        echo " -> Building for $GOOS/$GOARCH (ARMv6)..."
        env GIN_MODE=release CGO_ENABLED=0 GOOS=$GOOS GOARCH=$GOARCH GOARM=6 \
            go build -ldflags="-s -w" -o "${output_name}v6" ./cmd/server

        echo " -> Building for $GOOS/$GOARCH (ARMv7)..."
        env GIN_MODE=release CGO_ENABLED=0 GOOS=$GOOS GOARCH=$GOARCH GOARM=7 \
            go build -ldflags="-s -w" -o "${output_name}v7" ./cmd/server

    else
        echo " -> Building for $GOOS/$GOARCH..."

        EXTRA_ENV=""

        if [ "$GOARCH" = "mips" ] || [ "$GOARCH" = "mipsle" ]; then
            EXTRA_ENV="GOMIPS=softfloat"
        fi

        env GIN_MODE=release CGO_ENABLED=0 GOOS=$GOOS GOARCH=$GOARCH $EXTRA_ENV \
            go build -ldflags="-s -w" -o "$output_name" ./cmd/server
    fi

    if [ $? -ne 0 ]; then
        echo 'An error has occurred! Aborting the script execution...'
        exit 1
    fi
done

echo "[5/5] Build complete!"
echo ""
echo "Binaries available in backend/bin/"
ls -1 "$PROJECT_ROOT/backend/bin/"

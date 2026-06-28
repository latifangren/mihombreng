# ── Stage 1: Build frontend ──────────────────────────────
FROM node:20-alpine AS frontend

WORKDIR /build/web
COPY web/package.json web/package-lock.json* ./
RUN npm ci
COPY web/ .
RUN npm run build

# ── Stage 2: Build Go backend (with embedded frontend) ──
FROM golang:1.23-alpine AS backend

RUN apk add --no-cache swig git

WORKDIR /build/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# Copy frontend dist for Go embed
COPY --from=frontend /build/web/dist/ internal/ui/dist/

COPY backend/ .
RUN go build -ldflags="-s -w" -o /build/mihombreng ./cmd/server

# ── Stage 3: Download Mihomo + assets ──────────────────
FROM alpine:latest AS downloader

RUN apk add --no-cache wget curl unzip tar gzip

WORKDIR /downloads

ARG MIHOMO_VERSION=v1.19.17
ARG TARGETARCH

RUN case ${TARGETARCH} in \
    amd64) MIHOMO_ARCH="mihomo-linux-amd64-v1" ;; \
    arm64) MIHOMO_ARCH="mihomo-linux-arm64" ;; \
    armv7) MIHOMO_ARCH="mihomo-linux-armv7" ;; \
    *) echo "Unsupported architecture: ${TARGETARCH}" && exit 1 ;; \
    esac && \
    wget -q -O mihomo.gz "https://github.com/MetaCubeX/mihomo/releases/download/${MIHOMO_VERSION}/${MIHOMO_ARCH}-${MIHOMO_VERSION}.gz" && \
    gunzip mihomo.gz && \
    chmod +x mihomo

RUN wget -q -O country.mmdb "https://github.com/rtaserver/meta-rules-dat/releases/latest/download/country.mmdb" && \
    wget -q -O geoip.dat "https://github.com/rtaserver/meta-rules-dat/releases/latest/download/geoip.dat" && \
    wget -q -O geosite.dat "https://github.com/rtaserver/meta-rules-dat/releases/latest/download/geosite.dat" && \
    wget -q -O geoip.metadb "https://github.com/rtaserver/meta-rules-dat/releases/download/latest/geoip.metadb"

RUN mkdir -p ui/zashboard ui/metacubexd ui/yacd

RUN curl -sL -o zashboard.zip "https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip" && \
    unzip -q zashboard.zip -d zashboard_temp && \
    mv zashboard_temp/dist/* ui/zashboard/ && \
    rm -rf zashboard_temp zashboard.zip

RUN curl -sL -o metacubexd.tgz "https://github.com/MetaCubeX/metacubexd/releases/latest/download/compressed-dist.tgz" && \
    tar -xzf metacubexd.tgz -C ui/metacubexd && \
    rm metacubexd.tgz

RUN curl -sL -o yacd.zip "https://github.com/MetaCubeX/Yacd-meta/archive/refs/heads/gh-pages.zip" && \
    unzip -q yacd.zip -d yacd_temp && \
    mv yacd_temp/Yacd-meta-gh-pages/* ui/yacd/ && \
    rm -rf yacd_temp yacd.zip

# ── Stage 4: Final image ──────────────────────────────
FROM alpine:latest

RUN apk add --no-cache ca-certificates iptables ip6tables iproute2 tzdata wget

RUN mkdir -p /etc/mihombreng/configs \
    /etc/mihombreng/proxy_providers \
    /etc/mihombreng/rule_providers \
    /etc/mihombreng/ui \
    /var/log

# Mihombreng binary (with embedded dashboard)
COPY --from=backend /build/mihombreng /usr/share/mihombreng/mihombreng

# Mihomo binary
COPY --from=downloader /downloads/mihomo /usr/bin/mihomo

# Geo assets
COPY --from=downloader /downloads/*.mmdb /etc/mihombreng/
COPY --from=downloader /downloads/*.dat /etc/mihombreng/
COPY --from=downloader /downloads/*.metadb /etc/mihombreng/

# Third-party dashboards
COPY --from=downloader /downloads/ui /etc/mihombreng/ui

WORKDIR /etc/mihombreng

EXPOSE 7777 9090 7890 7891 9091

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:7777/api/app/config || exit 1

CMD ["/usr/share/mihombreng/mihombreng", "-c", "/etc/mihombreng/mihombreng.yaml"]

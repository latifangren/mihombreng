# Mihombreng Packaging

PKG_NAME:=mihombreng
PKG_VERSION:=1.0.0
PKG_RELEASE:=5
PKG_MAINTAINER:=latifangren
PKG_DESC:=Mihombreng Core + Mihomo

# Architecture Mappings
PKG_ARCH_AMD64:=amd64
PKG_ARCH_ARM64:=arm64
PKG_ARCH_ARMHF:=armhf
PKG_ARCH_ARCH_X86_64:=x86_64
PKG_ARCH_ARCH_AARCH64:=aarch64
PKG_ARCH_ARCH_ARMV7H:=armv7h

BUILD_DIR:=build
CORE_DIR:=core
FILES_DIR:=defaults
SYSTEMD_DIR:=deploy/systemd

# Binary mappings
BIN_AMD64:=mihombreng-linux-amd64
BIN_ARM64:=mihombreng-linux-arm64
BIN_ARMHF:=mihombreng-linux-armv7

# Mihomo
MIHOMO_VERSION:=v1.19.28
MIHOMO_URL_BASE:=https://github.com/MetaCubeX/mihomo/releases/download/$(MIHOMO_VERSION)
MIHOMO_ARCH_AMD64:=mihomo-linux-amd64-v1
MIHOMO_ARCH_ARM64:=mihomo-linux-arm64
MIHOMO_ARCH_ARMHF:=mihomo-linux-armv7

# GeoIP / Geosite
URL_GEOIP_MMDB:=https://github.com/rtaserver/meta-rules-dat/releases/latest/download/country.mmdb
URL_GEOIP_DAT:=https://github.com/rtaserver/meta-rules-dat/releases/latest/download/geoip.dat
URL_GEOSITE:=https://github.com/rtaserver/meta-rules-dat/releases/latest/download/geosite.dat
URL_GEOIP_META:=https://github.com/rtaserver/meta-rules-dat/releases/download/latest/geoip.metadb

.PHONY: all clean download-assets build-core build-amd64 build-arm64 build-armhf deb-amd64 deb-arm64 deb-armhf arch-x86_64 arch-aarch64 arch-armv7h build-all build-deb build-arch backend-build web-build docker-build help

help:
	@echo "Mihombreng Build System"
	@echo ""
	@echo "Packaging targets (CI):"
	@echo "  make build-all       - Build all packages (Debian + Arch)"
	@echo "  make build-deb       - Build Debian/Ubuntu packages"
	@echo "  make build-arch      - Build Arch Linux packages"
	@echo ""
	@echo "Development targets:"
	@echo "  make backend-build   - Build Go binary (single arch)"
	@echo "  make web-build       - Build frontend assets"
	@echo "  make docker-build    - Build Docker image"
	@echo ""
	@echo "Utility targets:"
	@echo "  make build-core      - Build multi-arch binaries + assets"
	@echo "  make download-assets - Download Mihomo, GeoIP, UI assets"
	@echo "  make clean           - Remove build artifacts"
	@echo ""
	@echo "OpenWrt targets:"
	@echo "  make openwrt-build   - Build OpenWrt packages"
	@echo "  make openwrt-clean   - Clean OpenWrt build artifacts"

# ── Delegating targets ──────────────────────────────────────

all: build-deb build-arch
build-deb: deb-amd64 deb-arm64 deb-armhf
build-arch: arch-x86_64 arch-aarch64 arch-armv7h
build-all: all

backend-build:
	$(MAKE) -C backend build

web-build:
	cd web && npm install && npm run build

docker-build:
	docker build -f deploy/docker/Dockerfile -t mihombreng:latest .

# ── Single-arch build (for deb-*/arch-* targets) ────────────

build-amd64:
	@echo "[1/4] Building frontend..."
	@cd web && npm install && npm run build
	@echo "[2/4] Generating Swagger docs..."
	@cd backend && export PATH=$$HOME/go/bin:$$PATH && swag init -g cmd/server/main.go -o docs
	@echo "[3/4] Preparing static files..."
	@cd backend && rm -rf internal/ui/dist && cp -r ../web/dist internal/ui/dist && chmod -R 755 internal/ui/dist
	@echo "[4/4] Building Go binary (linux/amd64)..."
	@cd backend && mkdir -p bin && env GIN_MODE=release CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bin/mihombreng-linux-amd64 ./cmd/server
	@mkdir -p $(CORE_DIR) && cp backend/bin/mihombreng-linux-amd64 $(CORE_DIR)/$(BIN_AMD64)
	@echo "Done: $(CORE_DIR)/$(BIN_AMD64)"

build-arm64:
	@echo "[1/4] Building frontend..."
	@cd web && npm install && npm run build
	@echo "[2/4] Generating Swagger docs..."
	@cd backend && export PATH=$$HOME/go/bin:$$PATH && swag init -g cmd/server/main.go -o docs
	@echo "[3/4] Preparing static files..."
	@cd backend && rm -rf internal/ui/dist && cp -r ../web/dist internal/ui/dist && chmod -R 755 internal/ui/dist
	@echo "[4/4] Building Go binary (linux/arm64)..."
	@cd backend && mkdir -p bin && env GIN_MODE=release CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -ldflags="-s -w" -o bin/mihombreng-linux-arm64 ./cmd/server
	@mkdir -p $(CORE_DIR) && cp backend/bin/mihombreng-linux-arm64 $(CORE_DIR)/$(BIN_ARM64)
	@echo "Done: $(CORE_DIR)/$(BIN_ARM64)"

build-armhf:
	@echo "[1/4] Building frontend..."
	@cd web && npm install && npm run build
	@echo "[2/4] Generating Swagger docs..."
	@cd backend && export PATH=$$HOME/go/bin:$$PATH && swag init -g cmd/server/main.go -o docs
	@echo "[3/4] Preparing static files..."
	@cd backend && rm -rf internal/ui/dist && cp -r ../web/dist internal/ui/dist && chmod -R 755 internal/ui/dist
	@echo "[4/4] Building Go binary (linux/arm/v7)..."
	@cd backend && mkdir -p bin && env GIN_MODE=release CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=7 go build -ldflags="-s -w" -o bin/mihombreng-linux-armv7 ./cmd/server
	@mkdir -p $(CORE_DIR) && cp backend/bin/mihombreng-linux-armv7 $(CORE_DIR)/$(BIN_ARMHF)
	@echo "Done: $(CORE_DIR)/$(BIN_ARMHF)"

# ── Multi-arch build (CI) ───────────────────────────────────

build-core:
	@echo "Installing Swag..."
	(which swag >/dev/null 2>&1) || (go install github.com/swaggo/swag/cmd/swag@latest && export PATH=$$HOME/go/bin:$$PATH)
	@echo "Building binaries..."
	export PATH=$$HOME/go/bin:$$PATH && bash scripts/build.sh
	@echo "Copying binaries..."
	mkdir -p $(CORE_DIR)
	cp backend/bin/mihombreng-linux-amd64 $(CORE_DIR)/$(BIN_AMD64)
	cp backend/bin/mihombreng-linux-arm64 $(CORE_DIR)/$(BIN_ARM64)
	cp backend/bin/mihombreng-linux-armv7 $(CORE_DIR)/$(BIN_ARMHF)

clean:
	rm -rf $(BUILD_DIR) $(CORE_DIR)
	rm -rf backend/bin web/node_modules web/dist backend/internal/ui/dist

# ── OpenWrt Package ────────────────────────────────────────

openwrt-build:
	@echo "Building OpenWrt package..."
	@test -n "$(ARCH)" || (echo "Error: ARCH not set. Usage: make openwrt-build ARCH=aarch64"; exit 1)
	$(SCRIPT_DIR)/build-openwrt.sh \
		--arch=$(ARCH) \
		--build-dir=$(BUILD_DIR) \
		--mihomo-version=$(MIHOMO_VERSION) \
		--mihomo-arch=$(MIHOMO_ARCH)
	cd deploy/openwrt/mihombreng && $(MAKE) package/mihombreng/compile V=s

openwrt-clean:
	@echo "Cleaning OpenWrt build artifacts..."
	rm -rf $(BUILD_DIR)/openwrt
	cd deploy/openwrt/mihombreng && $(MAKE) clean

download-assets:
	mkdir -p $(BUILD_DIR)/assets
	@echo "Downloading GeoIP assets..."
	[ -f $(BUILD_DIR)/assets/country.mmdb ] || wget -q -O $(BUILD_DIR)/assets/country.mmdb $(URL_GEOIP_MMDB)
	[ -f $(BUILD_DIR)/assets/geoip.dat ] || wget -q -O $(BUILD_DIR)/assets/geoip.dat $(URL_GEOIP_DAT)
	[ -f $(BUILD_DIR)/assets/geosite.dat ] || wget -q -O $(BUILD_DIR)/assets/geosite.dat $(URL_GEOSITE)
	[ -f $(BUILD_DIR)/assets/geoip.metadb ] || wget -q -O $(BUILD_DIR)/assets/geoip.metadb $(URL_GEOIP_META)
	@echo "Downloading UI assets..."
	[ -f $(BUILD_DIR)/assets/zashboard.zip ] || curl -sL -o $(BUILD_DIR)/assets/zashboard.zip "https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip"
	rm -rf $(BUILD_DIR)/assets/ui/zashboard $(BUILD_DIR)/assets/temp_zashboard
	mkdir -p $(BUILD_DIR)/assets/ui/zashboard
	unzip -q -o $(BUILD_DIR)/assets/zashboard.zip -d $(BUILD_DIR)/assets/temp_zashboard
	mv $(BUILD_DIR)/assets/temp_zashboard/dist/* $(BUILD_DIR)/assets/ui/zashboard/
	rm -rf $(BUILD_DIR)/assets/temp_zashboard
	[ -f $(BUILD_DIR)/assets/metacubexd.tgz ] || curl -sL -o $(BUILD_DIR)/assets/metacubexd.tgz "https://github.com/MetaCubeX/metacubexd/releases/latest/download/compressed-dist.tgz"
	rm -rf $(BUILD_DIR)/assets/ui/metacubexd
	mkdir -p $(BUILD_DIR)/assets/ui/metacubexd
	tar -xzf $(BUILD_DIR)/assets/metacubexd.tgz -C $(BUILD_DIR)/assets/ui/metacubexd --strip-components=0
	[ -f $(BUILD_DIR)/assets/yacd.zip ] || curl -sL -o $(BUILD_DIR)/assets/yacd.zip "https://github.com/MetaCubeX/Yacd-meta/archive/refs/heads/gh-pages.zip"
	rm -rf $(BUILD_DIR)/assets/ui/yacd $(BUILD_DIR)/assets/temp_yacd
	mkdir -p $(BUILD_DIR)/assets/ui/yacd
	unzip -q -o $(BUILD_DIR)/assets/yacd.zip -d $(BUILD_DIR)/assets/temp_yacd
	mv $(BUILD_DIR)/assets/temp_yacd/Yacd-meta-gh-pages/* $(BUILD_DIR)/assets/ui/yacd/
	rm -rf $(BUILD_DIR)/assets/temp_yacd

# ── Debian Package ──────────────────────────────────────────

define build_deb
	@echo "Building deb for $(1)..."
	$(eval PKG_DIR := $(BUILD_DIR)/$(PKG_NAME)_$(PKG_VERSION)-$(PKG_RELEASE)_$(1))
	rm -rf $(PKG_DIR)
	mkdir -p $(PKG_DIR)/usr/share/mihombreng
	mkdir -p $(PKG_DIR)/usr/bin
	mkdir -p $(PKG_DIR)/etc/mihombreng
	mkdir -p $(PKG_DIR)/lib/systemd/system
	mkdir -p $(PKG_DIR)/DEBIAN

	# Mihombreng binary
	@if [ -f $(CORE_DIR)/$(2) ]; then \
		cp $(CORE_DIR)/$(2) $(PKG_DIR)/usr/share/mihombreng/mihombreng; \
		chmod +x $(PKG_DIR)/usr/share/mihombreng/mihombreng; \
	else \
		echo "Error: $(CORE_DIR)/$(2) not found!"; exit 1; \
	fi

	# Mihomo binary
	@if [ ! -f $(BUILD_DIR)/assets/mihomo-$(1) ]; then \
		echo "Downloading Mihomo $(MIHOMO_VERSION) for $(1)..."; \
		wget -q -O $(BUILD_DIR)/assets/mihomo-$(1).gz $(MIHOMO_URL_BASE)/$(3)-$(MIHOMO_VERSION).gz; \
		gunzip $(BUILD_DIR)/assets/mihomo-$(1).gz; \
		chmod +x $(BUILD_DIR)/assets/mihomo-$(1); \
	fi
	cp $(BUILD_DIR)/assets/mihomo-$(1) $(PKG_DIR)/usr/bin/mihomo
	chmod +x $(PKG_DIR)/usr/bin/mihomo

	# Config files
	cp -r $(FILES_DIR)/* $(PKG_DIR)/etc/mihombreng/

	# GeoIP / Geosite assets
	cp $(BUILD_DIR)/assets/*.mmdb $(PKG_DIR)/etc/mihombreng/ || true
	cp $(BUILD_DIR)/assets/*.dat $(PKG_DIR)/etc/mihombreng/ || true
	cp $(BUILD_DIR)/assets/*.metadb $(PKG_DIR)/etc/mihombreng/ || true
	cp -r $(BUILD_DIR)/assets/ui $(PKG_DIR)/etc/mihombreng/

	# DEBIAN control
	echo "Package: $(PKG_NAME)" > $(PKG_DIR)/DEBIAN/control
	echo "Version: $(PKG_VERSION)-$(PKG_RELEASE)" >> $(PKG_DIR)/DEBIAN/control
	echo "Section: net" >> $(PKG_DIR)/DEBIAN/control
	echo "Priority: optional" >> $(PKG_DIR)/DEBIAN/control
	echo "Architecture: $(1)" >> $(PKG_DIR)/DEBIAN/control
	echo "Maintainer: $(PKG_MAINTAINER)" >> $(PKG_DIR)/DEBIAN/control
	echo "Depends: iproute2, ca-certificates, iptables, nftables" >> $(PKG_DIR)/DEBIAN/control
	echo "Description: $(PKG_DESC)" >> $(PKG_DIR)/DEBIAN/control
	echo "  Mihombreng core binary packaged for Debian/Ubuntu" >> $(PKG_DIR)/DEBIAN/control

	# Systemd service (from source file)
	cp $(SYSTEMD_DIR)/mihombreng.service $(PKG_DIR)/lib/systemd/system/mihombreng.service

	# postinst
	echo "#!/bin/sh" > $(PKG_DIR)/DEBIAN/postinst
	echo "set -e" >> $(PKG_DIR)/DEBIAN/postinst
	echo "if [ \"\$$1\" = \"configure\" ]; then" >> $(PKG_DIR)/DEBIAN/postinst
	echo "    systemctl daemon-reload" >> $(PKG_DIR)/DEBIAN/postinst
	echo "    systemctl enable mihombreng" >> $(PKG_DIR)/DEBIAN/postinst
	echo "    systemctl restart mihombreng || true" >> $(PKG_DIR)/DEBIAN/postinst
	echo "fi" >> $(PKG_DIR)/DEBIAN/postinst
	chmod 755 $(PKG_DIR)/DEBIAN/postinst

	# prerm
	echo "#!/bin/sh" > $(PKG_DIR)/DEBIAN/prerm
	echo "set -e" >> $(PKG_DIR)/DEBIAN/prerm
	echo "if [ \"\$$1\" = \"remove\" ]; then" >> $(PKG_DIR)/DEBIAN/prerm
	echo "    systemctl stop mihombreng || true" >> $(PKG_DIR)/DEBIAN/prerm
	echo "    systemctl disable mihombreng || true" >> $(PKG_DIR)/DEBIAN/prerm
	echo "fi" >> $(PKG_DIR)/DEBIAN/prerm
	chmod 755 $(PKG_DIR)/DEBIAN/prerm

	dpkg-deb --build $(PKG_DIR)
	@echo "Package: $(PKG_DIR).deb"
endef

deb-amd64: build-amd64 download-assets
	$(call build_deb,$(PKG_ARCH_AMD64),$(BIN_AMD64),$(MIHOMO_ARCH_AMD64))

deb-arm64: build-arm64 download-assets
	$(call build_deb,$(PKG_ARCH_ARM64),$(BIN_ARM64),$(MIHOMO_ARCH_ARM64))

deb-armhf: build-armhf download-assets
	$(call build_deb,$(PKG_ARCH_ARMHF),$(BIN_ARMHF),$(MIHOMO_ARCH_ARMHF))

# ── Arch Linux Package ──────────────────────────────────────

define build_arch
	@echo "Building arch package for $(1)..."
	$(eval PKG_DIR := $(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)-$(PKG_RELEASE)-$(1))
	rm -rf $(PKG_DIR)
	mkdir -p $(PKG_DIR)/usr/share/mihombreng
	mkdir -p $(PKG_DIR)/usr/bin
	mkdir -p $(PKG_DIR)/etc/mihombreng
	mkdir -p $(PKG_DIR)/usr/lib/systemd/system

	# Mihombreng binary
	@if [ -f $(CORE_DIR)/$(2) ]; then \
		cp $(CORE_DIR)/$(2) $(PKG_DIR)/usr/share/mihombreng/mihombreng; \
		chmod +x $(PKG_DIR)/usr/share/mihombreng/mihombreng; \
	else \
		echo "Error: $(CORE_DIR)/$(2) not found!"; exit 1; \
	fi

	# Mihomo binary
	@if [ ! -f $(BUILD_DIR)/assets/mihomo-$(1) ]; then \
		echo "Downloading Mihomo $(MIHOMO_VERSION) for $(1)..."; \
		wget -q -O $(BUILD_DIR)/assets/mihomo-$(1).gz $(MIHOMO_URL_BASE)/$(3)-$(MIHOMO_VERSION).gz; \
		gunzip $(BUILD_DIR)/assets/mihomo-$(1).gz; \
		chmod +x $(BUILD_DIR)/assets/mihomo-$(1); \
	fi
	cp $(BUILD_DIR)/assets/mihomo-$(1) $(PKG_DIR)/usr/bin/mihomo
	chmod +x $(PKG_DIR)/usr/bin/mihomo

	# Config files
	cp -r $(FILES_DIR)/* $(PKG_DIR)/etc/mihombreng/

	# GeoIP / Geosite assets
	cp $(BUILD_DIR)/assets/*.mmdb $(PKG_DIR)/etc/mihombreng/ || true
	cp $(BUILD_DIR)/assets/*.dat $(PKG_DIR)/etc/mihombreng/ || true
	cp $(BUILD_DIR)/assets/*.metadb $(PKG_DIR)/etc/mihombreng/ || true
	cp -r $(BUILD_DIR)/assets/ui $(PKG_DIR)/etc/mihombreng/

	# Systemd service (from source file)
	cp $(SYSTEMD_DIR)/mihombreng.service $(PKG_DIR)/usr/lib/systemd/system/mihombreng.service

	# .PKGINFO
	echo "pkgname = $(PKG_NAME)" > $(PKG_DIR)/.PKGINFO
	echo "pkgver = $(PKG_VERSION)-$(PKG_RELEASE)" >> $(PKG_DIR)/.PKGINFO
	echo "pkgdesc = $(PKG_DESC)" >> $(PKG_DIR)/.PKGINFO
	echo "url = https://github.com/latifangren/mihombreng" >> $(PKG_DIR)/.PKGINFO
	echo "builddate = $$(date +%s)" >> $(PKG_DIR)/.PKGINFO
	echo "packager = $(PKG_MAINTAINER)" >> $(PKG_DIR)/.PKGINFO
	echo "size = $$(du -sb $(PKG_DIR) | cut -f1)" >> $(PKG_DIR)/.PKGINFO
	echo "arch = $(1)" >> $(PKG_DIR)/.PKGINFO
	echo "depend = iproute2" >> $(PKG_DIR)/.PKGINFO
	echo "depend = ca-certificates" >> $(PKG_DIR)/.PKGINFO
	echo "depend = iptables" >> $(PKG_DIR)/.PKGINFO
	echo "depend = nftables" >> $(PKG_DIR)/.PKGINFO

	# .INSTALL
	echo "post_install() {" > $(PKG_DIR)/.INSTALL
	echo "    systemctl daemon-reload" >> $(PKG_DIR)/.INSTALL
	echo "    systemctl enable mihombreng" >> $(PKG_DIR)/.INSTALL
	echo "    systemctl start mihombreng || true" >> $(PKG_DIR)/.INSTALL
	echo "}" >> $(PKG_DIR)/.INSTALL
	echo "" >> $(PKG_DIR)/.INSTALL
	echo "post_upgrade() {" >> $(PKG_DIR)/.INSTALL
	echo "    systemctl daemon-reload" >> $(PKG_DIR)/.INSTALL
	echo "    systemctl restart mihombreng || true" >> $(PKG_DIR)/.INSTALL
	echo "}" >> $(PKG_DIR)/.INSTALL
	echo "" >> $(PKG_DIR)/.INSTALL
	echo "pre_remove() {" >> $(PKG_DIR)/.INSTALL
	echo "    systemctl stop mihombreng || true" >> $(PKG_DIR)/.INSTALL
	echo "    systemctl disable mihombreng || true" >> $(PKG_DIR)/.INSTALL
	echo "}" >> $(PKG_DIR)/.INSTALL

	# .MTREE
	cd $(PKG_DIR) && find . -type f -o -type l | LC_ALL=C sort | sed 's/^\.\///' > .MTREE

	# Build package
	cd $(PKG_DIR) && tar -cf - .PKGINFO .INSTALL .MTREE usr etc | zstd -19 -T0 -q -o ../$(PKG_NAME)-$(PKG_VERSION)-$(PKG_RELEASE)-$(1).pkg.tar.zst
	@echo "Package: $(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)-$(PKG_RELEASE)-$(1).pkg.tar.zst"
endef

arch-x86_64: build-amd64 download-assets
	$(call build_arch,$(PKG_ARCH_ARCH_X86_64),$(BIN_AMD64),$(MIHOMO_ARCH_AMD64))

arch-aarch64: build-arm64 download-assets
	$(call build_arch,$(PKG_ARCH_ARCH_AARCH64),$(BIN_ARM64),$(MIHOMO_ARCH_ARM64))

arch-armv7h: build-armhf download-assets
	$(call build_arch,$(PKG_ARCH_ARCH_ARMV7H),$(BIN_ARMHF),$(MIHOMO_ARCH_ARMHF))

include $(TOPDIR)/rules.mk

PKG_NAME:=mihombreng
PKG_VERSION:=$(shell grep -m 1 '^version:' ../../../defaults/mihombreng.yaml | awk '{print $$2}' | tr -d '"')
PKG_RELEASE:=1

PKG_MAINTAINER:=latifangren
PKG_LICENSE:=MIT

PKG_BUILD_DEPENDS:=node/host golang/host

MIHOMO_VERSION:=v1.19.28

include $(INCLUDE_DIR)/package.mk
include $(TOPDIR)/feeds/packages/lang/golang/golang-package.mk

GO_PKG:=github.com/latifangren/mihombreng

# Determine Mihomo arch suffix
MIHOMO_ARCH:=$(GO_ARCH)
ifeq ($(GO_ARCH),arm)
  MIHOMO_ARCH:=armv$(or $(GO_ARM),7)
else ifeq ($(findstring mips,$(GO_ARCH)),mips)
  MIHOMO_ARCH:=$(GO_ARCH)-$(or $(GO_MIPS),softfloat)
else ifeq ($(GO_ARCH),aarch64)
  MIHOMO_ARCH:=arm64
endif

define Package/mihombreng
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Mihombreng Core + Mihomo
  URL:=https://github.com/latifangren/mihombreng
  DEPENDS:=+ca-bundle +ip-full +kmod-tun +kmod-nft-core +kmod-nft-nat +kmod-nft-tproxy +kmod-nft-socket
endef

define Package/mihombreng/description
  Mihombreng + Mihomo Core Binary
endef

define Build/Prepare
	cp -a /feed/web $(PKG_BUILD_DIR)/web
	cp -a /feed/backend $(PKG_BUILD_DIR)/backend
	mkdir -p $(PKG_BUILD_DIR)/files
	cp -a /feed/defaults/* $(PKG_BUILD_DIR)/files/
endef

define Build/Compile
	@echo "Building frontend..."
	cd $(PKG_BUILD_DIR)/web && \
		npm ci && \
		npm run build


	@echo "Preparing static files..."
	rm -rf $(PKG_BUILD_DIR)/backend/internal/ui/dist
	cp -r $(PKG_BUILD_DIR)/web/dist $(PKG_BUILD_DIR)/backend/internal/ui/dist
	chmod -R 755 $(PKG_BUILD_DIR)/backend/internal/ui/dist

	@echo "Using pre-generated Swagger docs..."

	@echo "Compiling mihombreng Go binary..."
	cd $(PKG_BUILD_DIR)/backend && \
		$(GO_BIN_PATH) \
		GOOS=linux \
		GOARCH=$(GO_ARCH) \
		$(if $(findstring arm,$(GO_ARCH)),GOARM=$(or $(GO_ARM),7)) \
		$(if $(findstring mips,$(GO_ARCH)),GOMIPS=$(or $(GO_MIPS),softfloat)) \
		CGO_ENABLED=0 \
		go build -v -trimpath -ldflags="-s -w" -o $(PKG_BUILD_DIR)/mihombreng ./cmd/server

	@if [ "$(SMOKE_BUILD)" = "1" ]; then \
		echo "Smoke build: using placeholder Mihomo, GeoIP, and dashboard assets..."; \
		printf '#!/bin/sh\necho smoke-build-placeholder\n' > $(PKG_BUILD_DIR)/mihomo; \
		chmod +x $(PKG_BUILD_DIR)/mihomo; \
		: > $(PKG_BUILD_DIR)/country.mmdb; \
		: > $(PKG_BUILD_DIR)/geoip.dat; \
		: > $(PKG_BUILD_DIR)/geosite.dat; \
		: > $(PKG_BUILD_DIR)/geoip.metadb; \
		mkdir -p $(PKG_BUILD_DIR)/ui/zashboard $(PKG_BUILD_DIR)/ui/metacubexd; \
		printf '<!doctype html><title>smoke-build-placeholder</title>' > $(PKG_BUILD_DIR)/ui/zashboard/index.html; \
		printf '<!doctype html><title>smoke-build-placeholder</title>' > $(PKG_BUILD_DIR)/ui/metacubexd/index.html; \
	else \
		echo "Downloading Mihomo $(MIHOMO_VERSION)..."; \
		wget -q -O $(PKG_BUILD_DIR)/mihomo.gz "https://github.com/MetaCubeX/mihomo/releases/download/$(MIHOMO_VERSION)/mihomo-linux-$(MIHOMO_ARCH)-$(MIHOMO_VERSION).gz"; \
		gunzip -f $(PKG_BUILD_DIR)/mihomo.gz; \
		chmod +x $(PKG_BUILD_DIR)/mihomo; \
		echo "Downloading GeoIP assets..."; \
		wget -q -O $(PKG_BUILD_DIR)/country.mmdb https://github.com/MetaCubeX/meta-rules-dat/releases/latest/download/country.mmdb; \
		wget -q -O $(PKG_BUILD_DIR)/geoip.dat https://github.com/MetaCubeX/meta-rules-dat/releases/latest/download/geoip.dat; \
		wget -q -O $(PKG_BUILD_DIR)/geosite.dat https://github.com/MetaCubeX/meta-rules-dat/releases/latest/download/geosite.dat; \
		wget -q -O $(PKG_BUILD_DIR)/geoip.metadb https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.metadb; \
		echo "Downloading Zashboard..."; \
		curl -sL -o $(PKG_BUILD_DIR)/zashboard.zip "https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip"; \
		mkdir -p $(PKG_BUILD_DIR)/ui/zashboard; \
		unzip -q $(PKG_BUILD_DIR)/zashboard.zip -d $(PKG_BUILD_DIR)/temp_zashboard; \
		mv $(PKG_BUILD_DIR)/temp_zashboard/dist/* $(PKG_BUILD_DIR)/ui/zashboard/; \
		rm -rf $(PKG_BUILD_DIR)/temp_zashboard $(PKG_BUILD_DIR)/zashboard.zip; \
		echo "Downloading MetaCubeXD..."; \
		curl -sL -o $(PKG_BUILD_DIR)/metacubexd.tgz "https://github.com/MetaCubeX/metacubexd/releases/latest/download/compressed-dist.tgz"; \
		mkdir -p $(PKG_BUILD_DIR)/ui/metacubexd; \
		tar -xzf $(PKG_BUILD_DIR)/metacubexd.tgz -C $(PKG_BUILD_DIR)/ui/metacubexd; \
		rm $(PKG_BUILD_DIR)/metacubexd.tgz; \
	fi

endef

define Package/mihombreng/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_DIR) $(1)/usr/share/mihombreng
	$(INSTALL_DIR) $(1)/etc/mihombreng/configs
	$(INSTALL_DIR) $(1)/etc/mihombreng/proxy_providers
	$(INSTALL_DIR) $(1)/etc/mihombreng/rule_providers
	$(INSTALL_DIR) $(1)/etc/mihombreng/ui

	$(INSTALL_BIN) $(PKG_BUILD_DIR)/mihombreng $(1)/usr/share/mihombreng/mihombreng
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/mihomo $(1)/usr/bin/mihomo

	$(INSTALL_DATA) $(PKG_BUILD_DIR)/files/mihombreng.yaml $(1)/etc/mihombreng/
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/country.mmdb $(1)/etc/mihombreng/
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/geoip.dat $(1)/etc/mihombreng/
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/geosite.dat $(1)/etc/mihombreng/
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/geoip.metadb $(1)/etc/mihombreng/

	$(INSTALL_DATA) $(PKG_BUILD_DIR)/files/configs/* $(1)/etc/mihombreng/configs/
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/files/proxy_providers/* $(1)/etc/mihombreng/proxy_providers/
	$(INSTALL_DATA) $(PKG_BUILD_DIR)/files/rule_providers/* $(1)/etc/mihombreng/rule_providers/

	$(CP) -r $(PKG_BUILD_DIR)/ui/* $(1)/etc/mihombreng/ui/
endef

define Package/mihombreng/conffiles
/etc/mihombreng/mihombreng.yaml
/etc/mihombreng/configs/config.yaml
/etc/mihombreng/proxy_providers/id.yaml
/etc/mihombreng/proxy_providers/sg.yaml
/etc/mihombreng/rule_providers/general.yaml
endef

$(eval $(call BuildPackage,mihombreng))

include $(TOPDIR)/rules.mk

# Touch workflow path to validate dev smoke-build trigger.
PKG_NAME:=luci-app-mihombreng

PKG_VERSION:=1.0.0
PKG_RELEASE:=5

PKG_MAINTAINER:=latifangren

LUCI_TITLE:=LuCI WebUI for Mihombreng
LUCI_DEPENDS:=+mihombreng
LUCI_PKGARCH:=all

PKG_LICENSE:=MIT

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=$(LUCI_TITLE)
  PKGARCH:=$(LUCI_PKGARCH)
  DEPENDS:=$(LUCI_DEPENDS)
  MAINTAINER:=$(PKG_MAINTAINER)
endef

define Package/$(PKG_NAME)/description
  LuCI WebUI for Mihombreng (Mihomo Core Manager). Provides dashboard and server controls.
endef

define Build/Prepare
  mkdir -p $(PKG_BUILD_DIR)
endef

define Build/Compile
endef

define Package/$(PKG_NAME)/install
	# Init Script
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./root/etc/init.d/mihombreng $(1)/etc/init.d/mihombreng

	# LuCI Menu
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/* $(1)/usr/share/luci/menu.d/

	# ACL
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/* $(1)/usr/share/rpcd/acl.d/

	# JS Views
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/mihombreng
	$(INSTALL_DATA) ./root/www/luci-static/resources/view/mihombreng/* $(1)/www/luci-static/resources/view/mihombreng/
endef

define Package/$(PKG_NAME)/postinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] || {
  /etc/init.d/mihombreng enable
  /etc/init.d/mihombreng start
}
endef

define Package/$(PKG_NAME)/prerm
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] || {
  /etc/init.d/mihombreng stop
  /etc/init.d/mihombreng disable
}
endef

$(eval $(call BuildPackage,$(PKG_NAME)))

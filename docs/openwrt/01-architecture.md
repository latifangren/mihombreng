# Architecture

OpenWrt package architecture and component design for mihombreng.

## Design Principles

1. **Separation of Concerns**: Core package (Go binary + Mihomo) vs LuCI package (web UI)
2. **Thin SDK Makefiles**: Metadata + install rules only, build logic in scripts
3. **Reusable Build Infrastructure**: `scripts/build-openwrt.sh` calls main Makefile targets
4. **Maintainability**: Add features by editing scripts, not SDK Makefiles

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenWrt Router                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   luci-app-         │    │      mihombreng              │ │
│  │   mihombreng        │    │      (core package)          │ │
│  │                     │    │                              │ │
│  │  ┌───────────────┐  │    │  ┌────────────────────────┐  │ │
│  │  │ Menu Entries   │  │    │  │ Go Binary              │  │ │
│  │  │ (menu.d/)     │  │    │  │ (mihombreng)           │  │ │
│  │  └───────────────┘  │    │  └────────────────────────┘  │ │
│  │  ┌───────────────┐  │    │  ┌────────────────────────┐  │ │
│  │  │ ACL Rules     │  │    │  │ Mihomo Binary          │  │ │
│  │  │ (acl.d/)      │  │    │  │ (mihomo)               │  │ │
│  │  └───────────────┘  │    │  └────────────────────────┘  │ │
│  │  ┌───────────────┐  │    │  ┌────────────────────────┐  │ │
│  │  │ JS Views      │  │    │  │ Config Files           │  │ │
│  │  │ (dashboard,   │  │    │  │ (mihombreng.yaml, configs/)   │  │ │
│  │  │  server)      │  │    │  └────────────────────────┘  │ │
│  │  └───────────────┘  │    │  ┌────────────────────────┐  │ │
│  │  ┌───────────────┐  │    │  │ GeoIP/Geosite Assets   │  │ │
│  │  │ Init Script   │  │    │  │ (mmdb, dat, metadb)    │  │ │
│  │  │ (procd)       │  │    │  └────────────────────────┘  │ │
│  │  └───────────────┘  │    │  ┌────────────────────────┐  │ │
│  │                     │    │  │ UI Assets              │  │ │
│  │                     │    │  │ (zashboard, metacubexd) │  │ │
│  │                     │    │  └────────────────────────┘  │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    procd (init system)                   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    nftables (firewall)                   │ │
│  │                    fw4 (OpenWrt default)                 │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Package Relationships

```
luci-app-mihombreng
    │
    ├── depends on ──► mihombreng (core)
    │
    ├── installs ──► /etc/init.d/mihombreng (procd service)
    │
    ├── installs ──► /usr/share/luci/menu.d/ (LuCI menu)
    │
    ├── installs ──► /usr/share/rpcd/acl.d/ (ACL permissions)
    │
    └── installs ──► /www/luci-static/resources/view/mihombreng/ (JS views)
```

## Data Flow

```
┌──────────────┐     HTTP/WS      ┌──────────────┐     ubus      ┌──────────────┐
│   Browser    │ ◄──────────────► │  Go Backend  │ ◄───────────► │   procd      │
│  (LuCI UI)   │                  │ (mihombreng) │               │  (service)   │
└──────────────┘                  └──────────────┘               └──────────────┘
       │                                  │
       │                                  │
       ▼                                  ▼
┌──────────────┐                  ┌──────────────┐
│  iframe      │                  │   mihomo     │
│  (dashboard) │                  │   (proxy)    │
└──────────────┘                  └──────────────┘
```

## procd Integration

### Service Lifecycle

```bash
# Start
/etc/init.d/mihombreng start

# Stop
/etc/init.d/mihombreng stop

# Restart
/etc/init.d/mihombreng restart

# Enable on boot
/etc/init.d/mihombreng enable

# Disable on boot
/etc/init.d/mihombreng disable
```

### procd Parameters

```sh
procd_open_instance mihombreng
procd_set_param command "$BIN_PATH" -c "$CONFIG_FILE"
procd_set_param term_timeout 15
procd_set_param stdout 1
procd_set_param stderr 1
procd_set_param respawn
procd_close_instance
```

### Service Triggers

```sh
service_triggers() {
    procd_add_reload_trigger "mihombreng"
}
```

Triggers reload when `/etc/config/mihombreng` changes.

## LuCI Integration

### Menu Structure

```
admin/services/mihombreng/
├── Dashboard (iframe → Go server)
└── Server (start/restart/stop controls)
```

### ACL Permissions

```json
{
    "luci-app-mihombreng": {
        "read": {
            "ubus": { "service": ["list"] },
            "file": { "/etc/init.d/mihombreng": ["read"] }
        },
        "write": {
            "file": { "/etc/init.d/mihombreng": ["exec"] },
            "ubus": { "service": ["start", "stop", "delete"] }
        }
    }
}
```

### JS Views

1. **dashboard.js**: iframe pointing to Go server port, polls service status
2. **server.js**: Start/Restart/Stop buttons, service status indicator

## nftables Integration

### fw4 Detection

```go
func detectOpenWrtFw4() bool {
    // Check if inet fw4 table exists (OpenWrt default firewall)
    tables, _ := conn.ListTables()
    for _, table := range tables {
        if table.Name == "fw4" && table.Family == nftables.TableFamilyINet {
            return true
        }
    }
    return false
}
```

### Routing Modes

| Mode | nftables Tables | Use Case |
|------|-----------------|----------|
| TUN | `mihombreng_tun` | Full transparent proxy |
| TProxy | `mihombreng_tproxy` | HTTP/HTTPS proxy |
| Redirect | `mihombreng_redirect` | Simple redirect |

## Configuration Files

### Main Config

```
/etc/mihombreng/mihombreng.yaml
```

### Mihomo Config

```
/etc/mihombreng/configs/config.yaml
```

### Proxy Providers

```
/etc/mihombreng/proxy_providers/
```

### Rule Providers

```
/etc/mihombreng/rule_providers/
```

## File Layout on Target

```
/usr/bin/
└── mihomo                          # Mihomo binary

/usr/share/mihombreng/
└── mihombreng                      # Go backend binary

/etc/mihombreng/
├── mihombreng.yaml                        # Main config
├── country.mmdb                    # GeoIP database
├── geoip.dat                       # GeoIP data
├── geosite.dat                     # Geosite data
├── geoip.metadb                    # GeoIP metadata
├── configs/
│   └── config.yaml                 # Mihomo config
├── proxy_providers/
│   └── *.yaml                      # Proxy provider files
├── rule_providers/
│   └── *.yaml                      # Rule provider files
└── ui/
    ├── zashboard/                  # Zashboard UI
    └── metacubexd/                 # MetaCubeXD UI

/etc/init.d/
└── mihombreng                      # procd init script

/usr/share/luci/menu.d/
└── mihombreng.json                 # LuCI menu entries

/usr/share/rpcd/acl.d/
└── mihombreng.json                 # ACL permissions

/www/luci-static/resources/view/mihombreng/
├── dashboard.js                    # Dashboard iframe
└── server.js                       # Server controls
```

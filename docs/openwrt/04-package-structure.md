# Package Structure

Package file structure and contents for OpenWrt.

## Directory Layout

```
deploy/openwrt/
├── mihombreng/                              # Core package
│   └── Makefile                             # SDK build (Go + Mihomo + assets)
│
├── luci-app-mihombreng/                     # LuCI package
│   ├── Makefile                             # LuCI metadata
│   └── root/                                # LuCI files
│       ├── etc/
│       │   └── init.d/
│       │       └── mihombreng               # procd init script
│       ├── usr/
│       │   └── share/
│       │       ├── luci/
│       │       │   └── menu.d/
│       │       │       └── mihombreng.json  # LuCI menu entries
│       │       └── rpcd/
│       │           └── acl.d/
│       │               └── mihombreng.json  # ACL permissions
│       └── www/
│           └── luci-static/
│               └── resources/
│                   └── view/
│                       └── mihombreng/
│                           ├── dashboard.js # Dashboard iframe
│                           └── server.js    # Server controls
│
scripts/
└── build-openwrt.sh                         # Build script
```

## Core Package Files

### `deploy/openwrt/mihombreng/Makefile`

**Purpose**: OpenWrt SDK package definition for mihombreng core

**Contents**:
- Package metadata (name, version, maintainer, license)
- Source repository info
- Build dependencies
- Mihomo version and architecture mapping
- Package dependencies
- Build/Compile section (calls build script)
- Package/install section (installs files)
- Package/conffiles section (marks config files)

**Line count**: ~90 lines

## LuCI Package Files

### `deploy/openwrt/luci-app-mihombreng/Makefile`

**Purpose**: OpenWrt SDK package definition for LuCI web UI

**Contents**:
- Package metadata
- LuCI-specific settings (LUCI_TITLE, LUCI_DEPENDS)
- Package/install section (installs init script + LuCI files)
- Package/postinst section (enables and starts service)
- Package/prerm section (stops and disables service)

**Line count**: ~75 lines


### `deploy/openwrt/luci-app-mihombreng/root/etc/init.d/mihombreng`

**Purpose**: procd init script for mihombreng service

**Contents**:
```sh
#!/bin/sh /etc/rc.common

START=99
STOP=15
USE_PROCD=1

BIN_PATH="/usr/share/mihombreng/mihombreng"
CONFIG_FILE="/etc/mihombreng/mihombreng.yaml"

start_service() {
    procd_open_instance mihombreng
    procd_set_param command "$BIN_PATH" -c "$CONFIG_FILE"
    procd_set_param term_timeout 15
    procd_set_param stdout 1
    procd_set_param stderr 1
    
    procd_set_param respawn
    procd_close_instance
}

service_triggers() {
    procd_add_reload_trigger "mihombreng"
}
```

**Line count**: ~23 lines


### `deploy/openwrt/luci-app-mihombreng/root/usr/share/luci/menu.d/mihombreng.json`

**Purpose**: LuCI menu entries for mihombreng

**Contents**:
```json
{
    "admin/services/mihombreng": {
        "title": "Mihombreng",
        "order": 50,
        "action": {
            "type": "alias",
            "path": "admin/services/mihombreng/dashboard"
        }
    },
    "admin/services/mihombreng/dashboard": {
        "title": "Dashboard",
        "order": 10,
        "action": {
            "type": "view",
            "path": "mihombreng/dashboard"
        }
    },
    "admin/services/mihombreng/server": {
        "title": "Server",
        "order": 20,
        "action": {
            "type": "view",
            "path": "mihombreng/server"
        }
    }
}
```

**Line count**: ~26 lines


### `deploy/openwrt/luci-app-mihombreng/root/usr/share/rpcd/acl.d/mihombreng.json`

**Purpose**: ACL permissions for LuCI access control

**Contents**:
```json
{
    "luci-app-mihombreng": {
        "description": "Grant access to Mihombreng status and control",
        "read": {
            "ubus": {
                "service": [
                    "list"
                ]
            },
            "file": {
                "/etc/init.d/mihombreng": [
                    "read"
                ]
            }
        },
        "write": {
            "file": {
                "/etc/init.d/mihombreng": [
                    "exec"
                ]
            },
            "ubus": {
                "service": [
                    "start",
                    "stop",
                    "delete"
                ]
            }
        }
    }
}
```

**Line count**: ~31 lines


### `deploy/openwrt/luci-app-mihombreng/root/www/luci-static/resources/view/mihombreng/dashboard.js`

**Purpose**: Dashboard view with iframe pointing to Go server

**Contents**:
```javascript
'use strict';
'require view';
'require fs';
'require ui';
'require rpc';
'require poll';

var callServiceList = rpc.declare({
    object: 'service',
    method: 'list',
    params: ['name'],
    expect: { '': {} }
});

return view.extend({
    load: function () {
        return fs.read('/etc/mihombreng/mihombreng.yaml').then(function (content) {
            var port = '7777';
            if (content) {
                var match = content.match(/port:\s*["']?(\d+)["']?/);
                if (match) port = match[1];
            }
            return port;
        }).catch(function () { return '7777'; });
    },

    render: function (port) {
        var url = 'http://' + window.location.hostname + ':' + port;

        var iframe = E('iframe', {
            'src': url,
            'style': 'width: 100%; min-height: 85vh; border: none; display: none;',
            'title': 'Mihombreng Dashboard'
        });

        var warning = E('div', {
            'class': 'cbi-section',
            'style': 'display: none; text-align: center; margin-top: 50px; padding: 30px;'
        }, [
            E('h3', { 'style': 'color: #d9534f;' }, _('Service is Not Running')),
            E('p', { 'style': 'margin: 15px 0 25px;' }, _('The Mihombreng backend service is currently stopped. Please start the service to access the dashboard.')),
            E('div', {}, [
                E('button', {
                    'class': 'cbi-button cbi-button-action',
                    'click': function () {
                        window.location.href = L.url('admin', 'services', 'mihombreng', 'server');
                    }
                }, _('Go to Server Control'))
            ])
        ]);

        var container = E('div', {}, [warning, iframe]);

        var updateStatus = function () {
            return callServiceList('mihombreng').then(function (res) {
                var running = false;
                try {
                    var instances = res.mihombreng.instances;
                    for (var i in instances) {
                        if (instances[i].running) {
                            running = true;
                            break;
                        }
                    }
                } catch (e) { }

                if (running) {
                    if (iframe.style.display === 'none') {
                        warning.style.display = 'none';
                        iframe.style.display = 'block';
                        iframe.src = iframe.src;
                    }
                } else {
                    if (warning.style.display === 'none') {
                        iframe.style.display = 'none';
                        warning.style.display = 'block';
                    }
                }
            });
        };

        updateStatus();

        poll.add(updateStatus, 3);

        return container;
    },

    handleSave: null,
    handleSaveApply: null,
    handleReset: null
});
```

**Line count**: ~92 lines


### `deploy/openwrt/luci-app-mihombreng/root/www/luci-static/resources/view/mihombreng/server.js`

**Purpose**: Server control view with start/restart/stop buttons

**Contents**:
```javascript
'use strict';
'require view';
'require fs';
'require ui';
'require rpc';
'require poll';

var callServiceList = rpc.declare({
    object: 'service',
    method: 'list',
    params: ['name'],
    expect: { '': {} }
});

return view.extend({
    load: function () {
        return fs.read('/etc/mihombreng/mihombreng.yaml').then(function (content) {
            var port = '7777';
            if (content) {
                var match = content.match(/port:\s*["']?(\d+)["']?/);
                if (match) port = match[1];
            }
            return port;
        }).catch(function () { return '7777'; });
    },

    render: function (port) {
        var statusEl = E('span', { 'class': 'label' }, _('Checking...'));

        var btnStart = E('button', {
            'class': 'cbi-button cbi-button-apply',
            'disabled': true
        }, _('Start'));

        var btnRestart = E('button', {
            'class': 'cbi-button cbi-button-save',
            'disabled': true
        }, _('Restart'));

        var btnStop = E('button', {
            'class': 'cbi-button cbi-button-reset',
            'disabled': true
        }, _('Stop'));

        var btnOpen = E('button', {
            'class': 'cbi-button cbi-button-action',
            'disabled': true,
            'click': function () {
                var url = 'http://' + window.location.hostname + ':' + port;
                window.open(url, '_blank');
            }
        }, _('Open Dashboard'));

        var handleAction = function (action) {
            return fs.exec('/etc/init.d/mihombreng', [action]).then(function (res) {
                if (res.code !== 0) {
                    ui.addNotification(null, E('p', _('Command failed: %s').format(res.stderr || res.stdout)), 'error');
                    throw new Error(res.stderr || res.stdout);
                } else {
                    window.location.reload();
                }
            });
        };

        var handleStart = function () {
            return fs.exec('/etc/init.d/mihombreng', ['enable']).then(function () {
                return handleAction('start');
            });
        };

        var handleStop = function () {
            return handleAction('stop').then(function () {
                return fs.exec('/etc/init.d/mihombreng', ['disable']);
            });
        };

        btnStart.onclick = ui.createHandlerFn(this, handleStart);
        btnRestart.onclick = ui.createHandlerFn(this, function () { return handleAction('restart'); });
        btnStop.onclick = ui.createHandlerFn(this, handleStop);

        var updateStatus = function () {
            return callServiceList('mihombreng').then(function (res) {
                var running = false;
                try {
                    var instances = res.mihombreng.instances;
                    for (var i in instances) {
                        if (instances[i].running) {
                            running = true;
                            break;
                        }
                    }
                } catch (e) { }

                if (running) {
                    statusEl.textContent = _('Running');
                    statusEl.className = 'label success';

                    btnStart.setAttribute('disabled', 'disabled');
                    btnRestart.removeAttribute('disabled');
                    btnStop.removeAttribute('disabled');
                    btnOpen.removeAttribute('disabled');
                } else {
                    statusEl.textContent = _('Stopped');
                    statusEl.className = 'label important';

                    btnStart.removeAttribute('disabled');
                    btnRestart.setAttribute('disabled', 'disabled');
                    btnStop.setAttribute('disabled', 'disabled');
                    btnOpen.setAttribute('disabled', 'disabled');
                }
            }).catch(function () {
                statusEl.textContent = _('Error');
                statusEl.className = 'label warning';
            });
        };

        updateStatus();

        poll.add(updateStatus, 3);

        return E('div', { 'class': 'cbi-map' }, [
            E('h2', _('Mihombreng Control')),
            E('div', { 'class': 'cbi-section' }, [
                E('div', { 'class': 'cbi-value' }, [
                    E('label', { 'class': 'cbi-value-title' }, _('Service Status')),
                    E('div', { 'class': 'cbi-value-field' }, statusEl)
                ]),

                E('div', { 'class': 'cbi-section-descr' }, _('Control the Mihombreng backend service.')),

                E('div', { 'class': 'cbi-page-actions' }, [
                    btnStart, btnRestart, btnStop, btnOpen
                ])
            ])
        ]);
    },
    handleSave: null,
    handleSaveApply: null,
    handleReset: null
});
```

**Line count**: ~142 lines


## Build Script Files

### `scripts/build-openwrt.sh`

**Purpose**: Build script for OpenWrt packages (reuses main Makefile targets)

**Contents**:
- Parameter parsing (--arch, --build-dir, --mihomo-version, --mihomo-arch)
- Frontend build (npm install + npm run build)
- Swagger doc generation
- Static file preparation
- Go cross-compilation
- Mihomo download
- Asset download (GeoIP, UI)

**Line count**: ~120 lines


## File Counts

| Category | Files | Total Lines |
|----------|-------|-------------|
| Core Package | 1 | ~90 |
| LuCI Package | 6 | ~389 |
| Build Script | 1 | ~120 |
| **Total** | **8** | **~599** |

## Maintenance Guidelines

### Adding New Features

1. **Core package**: Edit `scripts/build-openwrt.sh` for build logic
2. **LuCI views**: Add new `.js` files in `root/www/luci-static/resources/view/mihombreng/`
3. **Menu entries**: Update `root/usr/share/luci/menu.d/mihombreng.json`
4. **ACL rules**: Update `root/usr/share/rpcd/acl.d/mihombreng.json`

### Updating Dependencies

1. **Mihomo version**: Update `MIHOMO_VERSION` in `deploy/openwrt/mihombreng/Makefile`
2. **Package version**: Update `PKG_VERSION` and `PKG_RELEASE` in both Makefiles
3. **Dependencies**: Update `DEPENDS` line in package Makefiles
4. **Smoke placeholders**: Keep `SMOKE_BUILD` behavior aligned with `Package/install` expectations when adding new runtime assets

### Testing Changes

1. **Local build**: `make openwrt-build ARCH=aarch64`
2. **QEMU test**: Install in QEMU OpenWrt image
3. **Real hardware**: Test on actual OpenWrt router
4. **CI validation**: Verify workflow produces correct packages

# LuCI Integration

LuCI web UI integration design for mihombreng.

## Overview

LuCI is the web interface for OpenWrt. This document describes how mihombreng integrates with LuCI to provide a seamless management experience.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LuCI Framework                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   Menu System        │    │      ACL System              │ │
│  │   (menu.d/)          │    │      (acl.d/)                │ │
│  │                     │    │                              │ │
│  │  ┌───────────────┐  │    │  ┌────────────────────────┐  │ │
│  │  │ Menu Entries   │  │    │  │ Read Permissions       │  │ │
│  │  │ (JSON)        │  │    │  │ (ubus, file)           │  │ │
│  │  └───────────────┘  │    │  └────────────────────────┘  │ │
│  │                     │    │  ┌────────────────────────┐  │ │
│  │                     │    │  │ Write Permissions      │  │ │
│  │                     │    │  │ (ubus, file)           │  │ │
│  │                     │    │  └────────────────────────┘  │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
│                                                             │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │   JS Views           │    │      Init Script             │ │
│  │   (view/)            │    │      (init.d/)               │ │
│  │                     │    │                              │ │
│  │  ┌───────────────┐  │    │  ┌────────────────────────┐  │ │
│  │  │ dashboard.js   │  │    │  │ procd Service          │  │ │
│  │  │ (iframe)       │  │    │  │ (start/stop/restart)   │  │ │
│  │  └───────────────┘  │    │  └────────────────────────┘  │ │
│  │  ┌───────────────┐  │    │  ┌────────────────────────┐  │ │
│  │  │ server.js      │  │    │  │ Service Triggers       │  │ │
│  │  │ (controls)     │  │    │  │ (config change)        │  │ │
│  │  └───────────────┘  │    │  └────────────────────────┘  │ │
│  └─────────────────────┘    └─────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Menu System

### Menu Structure

```
admin/services/mihombreng/
├── Dashboard (iframe → Go server)
└── Server (start/restart/stop controls)
```

### Menu JSON Format

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

### Menu Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Display name in menu |
| `order` | number | Menu order (lower = higher) |
| `action.type` | string | Action type: `alias`, `view`, `form`, `cbi` |
| `action.path` | string | Path to view or alias target |

### Menu Placement

- **Category**: `admin/services/` — under Services menu
- **Order**: `50` — after most services, before System
- **Submenus**: Dashboard (order 10), Server (order 20)

## ACL System

### ACL JSON Format

```json
{
    "luci-app-mihombreng": {
        "description": "Grant access to Mihombreng status and control",
        "read": {
            "ubus": {
                "service": ["list"]
            },
            "file": {
                "/etc/init.d/mihombreng": ["read"]
            }
        },
        "write": {
            "file": {
                "/etc/init.d/mihombreng": ["exec"]
            },
            "ubus": {
                "service": ["start", "stop", "delete"]
            }
        }
    }
}
```

### ACL Fields

| Field | Type | Description |
|-------|------|-------------|
| `description` | string | ACL description |
| `read.ubus` | object | ubus read permissions |
| `read.file` | object | file read permissions |
| `write.ubus` | object | ubus write permissions |
| `write.file` | object | file write permissions |

### Permissions

| Permission | Type | Purpose |
|------------|------|---------|
| `service:list` | ubus read | List services and their status |
| `/etc/init.d/mihombreng:read` | file read | Read init script |
| `/etc/init.d/mihombreng:exec` | file write | Execute init script |
| `service:start` | ubus write | Start service |
| `service:stop` | ubus write | Stop service |
| `service:delete` | ubus write | Delete service |

## JS Views

### Dashboard View (`dashboard.js`)

**Purpose**: Embed mihombreng WebUI in an iframe

**Features**:
- Reads port from `/etc/mihombreng/mihombreng.yaml`
- Creates iframe pointing to Go server
- Polls service status every 3 seconds
- Shows warning when service is stopped
- Links to Server control page

**Flow**:
```
1. Load config → extract port
2. Create iframe with port
3. Poll service status
4. If running: show iframe, hide warning
5. If stopped: hide iframe, show warning
```

### Server View (`server.js`)

**Purpose**: Control mihombreng service

**Features**:
- Service status indicator (Running/Stopped/Error)
- Start button (enable + start)
- Restart button (restart)
- Stop button (stop + disable)
- Open Dashboard button (opens in new tab)
- Polls service status every 3 seconds

**Flow**:
```
1. Load config → extract port
2. Create UI elements (status, buttons)
3. Poll service status
4. Update UI based on status
5. Handle button clicks → execute init.d commands
```

## View Registration

### File Naming Convention

```
www/luci-static/resources/view/{app-name}/{view-name}.js
```

**Example**:
```
www/luci-static/resources/view/mihombreng/dashboard.js
www/luci-static/resources/view/mihombreng/server.js
```

### View Module Format

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
        // Load data (config, etc.)
    },

    render: function (data) {
        // Render UI elements
    },

    handleSave: null,
    handleSaveApply: null,
    handleReset: null
});
```

### View Methods

| Method | Purpose | Return |
|--------|---------|--------|
| `load()` | Load data asynchronously | Promise |
| `render(data)` | Render UI elements | DOM element |
| `handleSave()` | Handle save action | null (read-only) |
| `handleSaveApply()` | Handle save+apply action | null (read-only) |
| `handleReset()` | Handle reset action | null (read-only) |

## RPC Calls

### Service List

```javascript
var callServiceList = rpc.declare({
    object: 'service',
    method: 'list',
    params: ['name'],
    expect: { '': {} }
});

callServiceList('mihombreng').then(function (res) {
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
});
```

### File System Operations

```javascript
// Read file
fs.read('/etc/mihombreng/mihombreng.yaml').then(function (content) {
    // Parse content
});

// Execute command
fs.exec('/etc/init.d/mihombreng', ['start']).then(function (res) {
    if (res.code !== 0) {
        // Handle error
    }
});
```

## Polling

### Poll Configuration

```javascript
var updateStatus = function () {
    return callServiceList('mihombreng').then(function (res) {
        // Update UI
    });
};

updateStatus();
poll.add(updateStatus, 3); // Poll every 3 seconds
```

### Poll Best Practices

1. **Interval**: 3 seconds for service status
2. **Cleanup**: Poll stops when view is destroyed
3. **Error handling**: Catch errors and update UI accordingly
4. **Debouncing**: Avoid rapid updates

## UI Components

### Buttons

```javascript
var btnStart = E('button', {
    'class': 'cbi-button cbi-button-apply',
    'disabled': true
}, _('Start'));
```

### Status Labels

```javascript
var statusEl = E('span', { 'class': 'label' }, _('Checking...'));

// Running
statusEl.textContent = _('Running');
statusEl.className = 'label success';

// Stopped
statusEl.textContent = _('Stopped');
statusEl.className = 'label important';

// Error
statusEl.textContent = _('Error');
statusEl.className = 'label warning';
```

### Sections

```javascript
E('div', { 'class': 'cbi-section' }, [
    E('div', { 'class': 'cbi-value' }, [
        E('label', { 'class': 'cbi-value-title' }, _('Service Status')),
        E('div', { 'class': 'cbi-value-field' }, statusEl)
    ]),
    E('div', { 'class': 'cbi-section-descr' }, _('Control the Mihombreng backend service.')),
    E('div', { 'class': 'cbi-page-actions' }, [
        btnStart, btnRestart, btnStop, btnOpen
    ])
]);
```

## Localization

### Translation Strings

```javascript
_('Service is Not Running')
_('The Mihombreng backend service is currently stopped.')
_('Go to Server Control')
_('Start')
_('Restart')
_('Stop')
_('Open Dashboard')
_('Service Status')
_('Control the Mihombreng backend service.')
_('Running')
_('Stopped')
_('Error')
_('Checking...')
_('Command failed: %s')
```

### Translation Files

```
/usr/share/luci/i18n/mihombreng.zh-cn.lmo
/usr/share/luci/i18n/mihombreng.id.lmo
```

## Testing

### Manual Testing

1. **Install packages**: `opkg install mihombreng_*.ipk luci-app-mihombreng_*.ipk`
2. **Access LuCI**: `http://openwrt/cgi-bin/luci`
3. **Navigate**: Services → Mihombreng
4. **Test Dashboard**: Verify iframe loads
5. **Test Server**: Verify start/stop/restart buttons work

### Automated Testing

```yaml
- name: Test LuCI Integration
  run: |
    # Start OpenWrt in QEMU
    # Install packages
    # Verify LuCI menu exists
    # Verify service starts
    # Verify iframe loads
```

## Troubleshooting

### Common Issues

1. **Menu not showing**: Check menu JSON syntax and file location
2. **ACL denied**: Verify ACL JSON and permissions
3. **View not loading**: Check JS file syntax and location
4. **RPC errors**: Verify init.d script is executable
5. **Iframe not loading**: Check port configuration and firewall

### Debug Mode

```javascript
// Add console.log for debugging
console.log('Port:', port);
console.log('Service status:', res);
```

### Logs

- **LuCI logs**: `/var/log/luci.log`
- **Service logs**: `logread | grep mihombreng`
- **Init script logs**: `/tmp/log/mihombreng.log`

## Future Improvements

1. **UCI integration**: Add UCI config support
2. **More views**: Add routing mode selector, config editor
3. **Real-time updates**: WebSocket for live status
4. **Charts**: Traffic and connection visualizations
5. **Mobile responsive**: Optimize for mobile LuCI

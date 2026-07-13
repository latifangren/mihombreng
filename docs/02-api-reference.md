# API Reference

Base URL: `http://<host>:7777`

All routes are prefixed with `/api/v1`. All responses are JSON unless noted otherwise.

## Response Format

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": "message" }
```

---

## App

### Config

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/app/config` | Get app config |
| PUT | `/api/v1/app/config` | Update app config |

**GET response:**

```json
{
  "mihomo": { "core_path": "...", "config_path": "...", ... },
  "logging": { "level": "info" }
}
```

**PUT request:**

```json
{
  "mihomo": {
    "core_path": "/usr/bin/mihomo",
    "config_path": "/etc/mihombreng/configs/config.yaml",
    "auto_restart": true
  },
  "logging": { "level": "debug" }
}
```

If `auto_restart` is true and mihomo is running, it auto-restarts after config update.

### Logs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/app/logs` | WebSocket — real-time app log stream |
| DELETE | `/api/v1/app/logs` | Clear app log file |

### Network Info

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/app/ipv4` | Get public IPv4 address |
| GET | `/api/v1/app/ipv6` | Get public IPv6 address |
| GET | `/api/v1/app/geo/ipv4` | Get IPv4 geolocation (country, city, ISP, ASN) |
| GET | `/api/v1/app/geo/ipv6` | Get IPv6 geolocation |

**GET `/api/v1/app/ipv4` response:**

```json
{ "success": true, "data": { "ip": "1.2.3.4" } }
```

**GET `/api/v1/app/geo/ipv4` response:**

```json
{
  "success": true,
  "data": {
    "ip": "1.2.3.4",
    "country": "Indonesia",
    "country_code": "ID",
    "city": "Jakarta",
    "isp": "Telkomsel",
    "asn": 17974,
    ...
  }
}
```

---

## Mihomo Control

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/mihomo/status` | Get running status |
| POST | `/api/v1/mihomo/start` | Start mihomo core |
| POST | `/api/v1/mihomo/stop` | Stop mihomo core |
| POST | `/api/v1/mihomo/restart` | Restart mihomo core |
| GET | `/api/v1/mihomo/core-version` | Get mihomo core version |

### Logs & Monitoring

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/mihomo/logs` | WebSocket — real-time mihomo log stream |
| DELETE | `/api/v1/mihomo/logs` | Clear mihomo log file |
| GET | `/api/v1/mihomo/memory` | WebSocket — memory usage stream |
| GET | `/api/v1/mihomo/traffic` | WebSocket — traffic stats stream |
| GET | `/api/v1/mihomo/connections` | WebSocket — active connections stream |

### Dashboard

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/mihomo/dashboard-info` | Get dashboard port, secret, and available dashboards |

**Response:**

```json
{
  "success": true,
  "data": {
    "port": "9090",
    "secret": "your-secret",
    "dashboards": ["metacubexd", "yacd"]
  }
}
```

### Authentication & Rate Limiting

When `api.auth_token` is enabled (configured as a non-empty string in `mihombreng.yaml` or set via `APP_AUTH_TOKEN` environment variable):
- Every HTTP request must include the `Authorization: Bearer <token>` header.
- Every WebSocket connection must authenticate, supporting either a `?token=...` query parameter or via `Sec-WebSocket-Protocol` header.
- Requests failing authentication will return `401 Unauthorized`.

Client IP-based rate limiting is enforced on all API endpoints. The rate limit defaults to 100 requests/second per IP (configurable via `api.rate_limit` in `mihombreng.yaml`). Excess requests will return `429 Too Many Requests`.

### Mihomo API Proxy

| Method | Path | Description |
|--------|------|-------------|
| Any | `/api/v1/mihomo/api/*path` | Proxy HTTP requests (GET/POST/PUT/DELETE) and WebSocket upgrades to Mihomo core API |

Proxies any path to the Mihomo external controller (`/proxies`, `/rules`, `/version`, etc.), replacing the client header with Mihomo's local API secret key. This transparent proxying allows Mihomo's external-controller port to remain bound exclusively to 127.0.0.1.

---

## Config Files

All file operations work on the mihombreng working directory (`/etc/mihombreng`).

### Configs

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/mihomo/configs` | List config files |
| GET | `/api/v1/mihomo/configs/:filename` | Read file content |
| GET | `/api/v1/mihomo/configs/:filename/download` | Download file |
| POST | `/api/v1/mihomo/configs` | Create new file |
| POST | `/api/v1/mihomo/configs/upload` | Upload file (multipart) |
| PUT | `/api/v1/mihomo/configs/:filename` | Update file content |
| PUT | `/api/v1/mihomo/configs/:filename/rename` | Rename file |
| DELETE | `/api/v1/mihomo/configs/:filename` | Delete file |

### Active Config

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/mihomo/active-config` | Get active config path |
| PUT | `/api/v1/mihomo/active-config` | Set active config path |

### Proxy Providers

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/mihomo/proxy-provider` | List proxy providers |
| GET | `/api/v1/mihomo/proxy-provider/:filename` | Read provider content |
| GET | `/api/v1/mihomo/proxy-provider/:filename/download` | Download provider |
| POST | `/api/v1/mihomo/proxy-provider` | Create new provider |
| POST | `/api/v1/mihomo/proxy-provider/upload` | Upload provider (multipart) |
| PUT | `/api/v1/mihomo/proxy-provider/:filename` | Update provider content |
| PUT | `/api/v1/mihomo/proxy-provider/:filename/rename` | Rename provider |
| DELETE | `/api/v1/mihomo/proxy-provider/:filename` | Delete provider |

### Rule Providers

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/mihomo/rule-provider` | List rule providers |
| GET | `/api/v1/mihomo/rule-provider/:filename` | Read provider content |
| GET | `/api/v1/mihomo/rule-provider/:filename/download` | Download provider |
| POST | `/api/v1/mihomo/rule-provider` | Create new provider |
| POST | `/api/v1/mihomo/rule-provider/upload` | Upload provider (multipart) |
| PUT | `/api/v1/mihomo/rule-provider/:filename` | Update provider content |
| PUT | `/api/v1/mihomo/rule-provider/:filename/rename` | Rename provider |
| DELETE | `/api/v1/mihomo/rule-provider/:filename` | Delete provider |

---

## DNS Lookup

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/dns/lookup` | Resolve domain to IPv4 + IPv6 |

**Request:**

```json
{ "domain": "example.com" }
```

**Response:**

```json
{
  "success": true,
  "domain": "example.com",
  "ipv4": ["93.184.216.34"],
  "ipv6": ["2606:2800:220:1:248:1893:25c8:1946"]
}
```

---

## Subscription Converter

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/converter/parse` | Parse proxy links or subscription URL |

Auto-detects: subscription URLs (http/https), single proxy links (vmess/vless/trojan/ss), or base64 content.

**Request (subscription URL):**

```json
{ "url": "https://example.com/sub" }
```

**Request (single link):**

```json
{ "url": "vmess://eyJhZGQ..." }
```

**Request (base64 content):**

```json
{ "content": "d3d3LmV4YW1wbGUuY29t..." }
```

**Response:**

```json
{
  "success": true,
  "proxies": [
    {
      "name": "US-Server-01",
      "type": "vmess",
      "server": "us.example.com",
      "port": 443
    }
  ],
  "count": 1
}
```

---

## Backup

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/backup/create` | Create tar.gz backup of working directory |
| POST | `/api/v1/backup/restore` | Restore from uploaded backup file |

**POST `/api/v1/backup/create`:** Returns binary `application/gzip` file (`mihombreng-backup-YYYYMMDD-HHMMSS.tar.gz`).

**POST `/api/v1/backup/restore`:** Accepts multipart form with backup `.tar.gz` file.

---

## WebSocket Streams

All WebSocket endpoints follow this message format:

```json
{ "level": "info", "message": "[TCP] amazon.com:443 --> proxy" }
```

For memory/traffic/connections, messages are JSON objects with live stats.

**Connect:**

```js
const ws = new WebSocket("ws://localhost:7777/api/v1/mihomo/logs");
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

---

## Endpoints Not Yet Implemented

These endpoints are documented here as planned but do not exist in the current router:

- `/api/v1/mihomo/tun/*` — TUN mode management
- `/api/v1/mihomo/redirect/*` — Redirect mode management
- `/api/v1/mihomo/tproxy/*` — TProxy mode management
- `/api/v1/mihomo/mixed/*` — Mixed mode management
- `/api/v1/openwrt/*` — OpenWrt-specific endpoints

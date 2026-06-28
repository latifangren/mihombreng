# handler/

## Sub-modules
| Directory | Responsibility | Map |
|-----------|---------------|-----|
| `app/` | Application config CRUD, diagnostics, public IP detection, GeoIP lookup | [View](app/codemap.md) |
| `backup/` | Backup lifecycle, retention, status monitoring, remote target operations (WebDAV) | [View](backup/codemap.md) |
| `converter/` | Proxy subscription/link parsing into structured proxy objects | [View](converter/codemap.md) |
| `dns/` | DNS domain resolution to IPv4/IPv6 addresses | [View](dns/codemap.md) |
| `mihomo/` | Mihomo service control, API proxy, file management, config validation, metrics, version/dashboard info | [View](mihomo/codemap.md) |
| `stream/` | WebSocket streaming for logs, traffic, memory, and connections | [View](stream/codemap.md) |
| `subscription/` | Subscription profile CRUD and refresh operations | [View](subscription/codemap.md) |

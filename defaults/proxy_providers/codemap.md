# proxy_providers/

## Responsibility
Default proxy provider definition file serving as a placeholder template for Mihomo proxy server lists. Provides the initial empty `proxies` array that users populate via the web UI or API to define upstream proxy servers (VMess, VLESS, Trojan, Shadowsocks, etc.) used for outbound traffic routing.

## Design
Single YAML file (`proxy.yaml`) conforming to Mihomo's proxy-provider file schema. Contains a top-level `proxies:` key with an empty list as the default seed. This file is referenced by `config.yaml` as a `file`-type proxy provider with a 300-second health-check interval against `http://www.gstatic.com/generate_204`. Users add proxy definitions through the management UI's subscription converter or manual entry, which writes directly to this file.

## Flow
```
config.yaml (proxy-providers.proxy)
  └─> proxy.yaml (loaded by mihomo core)
        └── proxies: [] (empty by default)
              └── Populated via:
                    ├── Web UI -> POST /api/v1/mihomo/proxy-providers (create)
                    ├── Web UI -> POST /api/v1/mihomo/proxy-providers/upload (multipart)
                    ├── Subscription converter -> POST /api/v1/converter/parse -> write
                    └── Direct file edit via config editor
```

## Integration
- **Consumer**: `config.yaml` declares `proxy-providers.proxy` with `path: ./proxy_providers/proxy.yaml`
- **API**: CRUD operations at `/api/v1/mihomo/proxy-providers/*` (list, read, create, update, delete, upload, download, rename)
- **Health check**: Mihomo pings `http://www.gstatic.com/generate_204` every 300s through each proxy
- **Frontend**: File manager component (`web/src/components/manager/`) and proxy provider UI manage this file

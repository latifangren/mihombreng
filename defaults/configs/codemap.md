# configs/

## Responsibility
Default Mihomo (Clash Meta) core configuration providing baseline proxy engine parameters. Defines network listener ports, DNS resolution strategy, traffic sniffing rules, proxy provider bindings, proxy group selections, and routing rule fallback behavior for the Mihombreng platform.

## Design
Single YAML configuration file (`config.yaml`) following the Mihomo `config.yaml` schema. The configuration uses a layered declarative model: port definitions at the top level, DNS in a nested block with dual-mode resolution (redir-host), a file-based proxy provider reference pointing to the sibling `proxy_providers/` directory, and a minimal proxy-group/rule setup with a single `MATCH` fallback rule. Sniffer configuration is port-scoped with domain skip-lists for Microsoft services. Profile persistence is enabled for server selection state.

## Flow
```
mihombreng.yaml (mihomo.config_path)
  └─> config.yaml (loaded by mihomo core at startup)
        ├── Ports: 7890 (HTTP), 7891 (redirect), 7892 (SOCKS), 7893 (mixed), 7894 (tproxy)
        ├── External controller: 0.0.0.0:9090 (API + dashboard)
        ├── DNS listener: 0.0.0.0:1053 (redir-host mode)
        │     ├── nameserver: Cloudflare DoH, Google DoH
        │     └── fallback: Cloudflare 1.1.1.1, 1.0.0.1
        ├── Sniffer: HTTP/80,8080-8880 + TLS/443,8443
        ├── proxy-provider.proxy -> ./proxy_providers/proxy.yaml (file type, 300s health check)
        └── rules: [MATCH -> Umum group]
```

## Integration
- **Upstream**: `mihombreng.yaml` sets `mihomo.config_path` to point here
- **Sibling**: References `proxy_providers/proxy.yaml` for proxy server definitions
- **Sibling**: `rule_providers/rule.yaml` available for rule provider imports
- **Consumer**: Mihomo core binary (`/usr/bin/mihomo`) parses this file at startup
- **API**: Go backend reads/writes this file via `/api/v1/mihomo/configs/config.yaml` endpoint
- **Frontend**: Config editor component in `web/src/components/config/` manages this file

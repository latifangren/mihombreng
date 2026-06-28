# systemd/

## Responsibility
systemd service unit definition for running Mihombreng as a managed background service on Linux distributions. Provides automatic process supervision with restart-on-failure semantics, ensuring the Mihombreng binary starts after network connectivity and persists across crashes.

## Design
Single `mihombreng.service` unit file following systemd `[Unit]/[Service]/[Install]` convention:
- **Type**: Implicit `simple` (default for `ExecStart` without `Type=` override)
- **Dependency**: `After=network.target` ensures network stack is initialized before startup
- **Execution**: Runs the Mihombreng binary with explicit config path (`-c /etc/mihombreng/mihombreng.yaml`)
- **Restart policy**: `Restart=always` with 5-second delay (`RestartSec=5`) for crash recovery
- **User**: Runs as `root` (required for iptables/nftables and TUN device operations)
- **Installation**: `WantedBy=multi-user.target` for standard multi-user boot

## Flow
```
systemd boot
  └─> network.target reached
        └─> mihombreng.service
              └── ExecStart: /usr/share/mihombreng/mihombreng -c /etc/mihombreng/mihombreng.yaml
                    ├── Loads mihombreng.yaml (app config, API server, CORS)
                    ├── Starts Gin HTTP server on :7777
                    ├── Loads mihomo core config from /etc/mihombreng/configs/config.yaml
                    └── On crash -> RestartSec=5s -> restart
```

## Integration
- **Binary path**: `/usr/share/mihombreng/mihombreng` (installed by Dockerfile stage 4 or manual install)
- **Config path**: `/etc/mihombreng/mihombreng.yaml` (from `defaults/mihombreng.yaml`)
- **Mihomo core**: `/usr/bin/mihomo` (referenced in mihombreng.yaml, managed by the Go backend)
- **Logs**: stdout captured by journald (`journalctl -u mihombreng`)
- **Install**: `systemctl enable --now mihombreng` for persistent service
- **Alternative**: OpenWrt uses procd init scripts instead (`/etc/init.d/mihombreng`)

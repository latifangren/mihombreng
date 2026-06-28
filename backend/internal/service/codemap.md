# service/

## Responsibility
Core service layer implementing the mihomo process lifecycle management and backup operations. Handles process start/stop/restart via PID file tracking, configuration adjustment (TUN enable/disable in YAML), routing setup coordination, log management, auto-start state persistence, readiness detection, backup lifecycle with retention policies, and remote backup target synchronization.

## Design
- **Struct service pattern**: `MihomoService` holds `*config.Config`, `configPath`, and `domain.NftablesService`. Implements the `domain.MihomoService` interface.
- **PID-based process management**: Status determined by reading `mihomo.pid` file and sending `signal(0)` to verify process liveness. Stale PID files are cleaned up automatically.
- **YAML config manipulation**: `adjustMihomoConfig()` reads the mihomo YAML config and programmatically toggles the `tun:` section (`enable: true/false`, `device:` field) using line-by-line string processing rather than a YAML parser.
- **Readiness polling**: `waitForMihomoReady()` polls up to 10s at 500ms intervals. For TUN mode, waits for the TUN network interface to appear via `netlink.LinkByName()`. For non-TUN, verifies process is alive.
- **Lifecycle coordination**: `Start()` orchestrates: kill existing -> adjust config -> clear logs -> spawn process -> write PID -> optionally setup routing via nftables.
- **Routing delegation**: Uses `domain.NftablesService` for `SetupRouting()` and `CleanupAllRouting()`.
- **Config persistence**: Saves `auto_start` flag to disk after start/stop to support state restoration on boot.

## Sub-modules
| Directory | Responsibility | Map |
|-----------|---------------|-----|
| `backup/` | Backup lifecycle: create, list, delete, restore, retention, remote targets (WebDAV) | [View](backup/codemap.md) |
| `routing/` | nftables/TProxy/Redirect routing setup and cleanup (Linux-specific) | [View](routing/codemap.md) |
| `subscription/` | Subscription profile CRUD, URL refresh, provider YAML materialization | [View](subscription/codemap.md) |

## Flow
- **Start**: Kill existing process -> adjust TUN config in YAML -> clear old log -> determine if routing needed -> `exec.Command` to spawn mihomo binary with `-d` and `-f` flags -> redirect stdout/stderr to log file -> write PID file -> wait for readiness (TUN interface or process alive) -> setup nftables routing -> save auto_start=true.
- **Stop**: Read PID file -> find process -> kill -> remove PID file -> cleanup routing if configured -> save auto_start=false (if saveState).
- **Restart**: Stop(false) -> Start().
- **GetStatus**: Read PID -> signal(0) -> "running" or "stopped".
- **RestoreState**: Check auto_start flag -> if true and stopped, auto-start.
- **GetLogs/ClearLogs**: Read/truncate the configured log file.
- **ensureTUNEnabled/ensureTUNDisabled**: Parse YAML lines, locate `tun:` section, toggle `enable:` field and set `device:` name.

## Integration
- **Depends on**: `domain.NftablesService` (for routing setup/cleanup), `pkg/config.Config` (all settings), `pkg/logger`, `pkg/apperror`, `vishvananda/netlink` (TUN interface detection).
- **Implements**: `domain.MihomoService` interface.
- **Consumed by**: All HTTP handlers (`mihomo`, `app`, `stream`, `backup`, `subscription`) via their respective handler constructors.
- **Consumed by**: Application bootstrap for `RestoreState()` on startup.

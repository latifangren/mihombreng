# config/

## Responsibility
Configuration loading, persistence, and type definitions for the entire application. Manages YAML-based config for server settings, mihomo core parameters, auto-restart options, routing policies, logging, API limits, auth tokens, CORS, backup rules, and unlock test target definitions. Auto-generates a default config file from environment variables when none exists. Separately parses mihomo's own YAML config to extract API endpoint and secret.

## Design
- **Separation of concerns across files**:
  - `types.go` — Pure data types: `Config`, `ServerConfig`, `MihomoConfig`, `AutoRestartSettings`, `RoutingConfig`, `LoggingConfig`, `APIConfig`, `CORSConfig`, `BackupConfig`, `RemoteBackupTarget`, `UnlockTestConfig`, `UnlockTestTargetConfig`. Dual-annotated with `yaml` and `json` struct tags.
  - `config.go` — `Load(path)` and `Save(path)` functions. `Load` auto-creates defaults if file missing. `Save` marshals to YAML and writes atomically (mkdir + write).
  - `mihomo.go` — `ParseMihomoConfig(configPath)` reads mihomo's external config YAML to extract `external-controller` URL and secret.
- **Routing modes**: Typed `RoutingMode` string enum with `tun`, `tproxy`, `redirect`, `disable` constants.
- **Auto-restart settings**: `AutoRestartSettings` configures automatic restart triggers on crash, config change, network change, routing failure, or scheduled intervals ("daily", "weekly").
- **Backup config**: `BackupConfig` with `auto_backup_enabled`, `max_backups`, `max_age_days`, `backup_dir`, and `RemoteBackupTarget` array.
- **Unlock test config**: `UnlockTestConfig` holds `UnlockTestTargetConfig` items (`id`, `name`, `url`, `host`, `expected`, `type` like "http", "tcp", "dns").
- **Default config**: Built-in defaults (port 7777, release mode, log to `/var/log/mihombreng.log`) with environment variable overrides via `getEnv()`. Default log and working directory paths are computed relative to the config file's parent directory.

## Flow
```
config.Load(path)
  ├── File exists → os.ReadFile → yaml.Unmarshal → *Config
  │     └── If MihomoConfig.ConfigPath set → ParseMihomoConfig → populate APIURL/APISecret
  └── File missing → createDefaultConfig(path)
        ├── Build defaults (getEnv overrides)
        ├── config.Save(path) → mkdirAll + WriteFile
        └── return *Config
```

## Integration
| Dependency | Direction | Purpose |
|---|---|---|
| `cmd/server/main.go` | consumed by | Initial config load at startup |
| `internal/service/*` | consumed by | Reads mihomo, logging, server, backup, and unlock test config |
| `internal/http/router` | consumed by | Reads API/CORS/Auth token config |
| `internal/http/handler/*` | consumed by | Reads backup/unlock test/system settings |
| `internal/domain/*` | consumed by | Service interfaces reference `MihomoConfig` and `Config` |
| `gopkg.in/yaml.v3` | external | YAML serialization/deserialization |

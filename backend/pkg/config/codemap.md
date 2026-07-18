# pkg/config/

## Configuration loading, persistence, and type definitions for the entire application. Manages YAML-based config for server settings, mihomo core parameters, logging, API limits, CORS, and backup policies. Auto-generates a default config file from environment variables when none exists. Separately parses mihomo's own YAML config to extract API endpoint and secret.

## Design
- **Separation of concerns across files**:
  - `types.go` — Pure data types: `Config`, `ServerConfig`, `MihomoConfig`, `RoutingConfig`, `LoggingConfig`, `APIConfig`, `CORSConfig`, `BackupConfig`, `RemoteBackupTarget`. All use `yaml` struct tags.
  - `config.go` — `Load(path)` and `Save(path)` functions. `Load` auto-creates defaults if file missing. `Save` marshals to YAML and writes atomically (mkdir + write).
  - `mihomo.go` — `ParseMihomoConfig(configPath)` reads mihomo's external config YAML to extract `external-controller` URL and secret.
- **Routing modes**: Typed `RoutingMode` string enum with `TUN`, `TProxy`, `Redirect`, `Disable` constants.
- **Backup config**: `BackupConfig` with `auto_backup_enabled`, `max_backups`, `max_age_days`, `backup_dir`.
- **Remote target config**: `RemoteBackupTarget` with `name`, `type`, `url`, `username`, `password`, `enabled`.
- **Default config**: Built-in defaults (port 7777, release mode, log to `/var/log/mihombreng.log`) with environment variable overrides via `getEnv()`. Default log and working directory paths are computed relative to the config file's parent directory — for example, when falling back to the user config, paths resolve to `~/.config/mihombreng/mihombreng.log` and `~/.config/mihombreng/` respectively.

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
| `internal/service/*` | consumed by | Reads mihomo, logging, server, and backup config |
| `internal/http/router` | consumed by | Reads API/CORS config |
| `internal/http/handler/backup` | consumed by | Reads backup config for retention/remote targets |
| `internal/domain/*` | consumed by | `MihomoService` interface uses `MihomoConfig` |
| `gopkg.in/yaml.v3` | external | YAML serialization/deserialization |

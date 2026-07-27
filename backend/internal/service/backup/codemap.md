# backup/

## Responsibility
Backup service layer — manages the complete backup lifecycle including creation, listing, restoration, deletion, retention policy enforcement, and remote target synchronization. Encapsulates all backup business logic separate from HTTP handlers.

## Design
- **Service struct pattern** (`service.go`): `Service` holds `*config.Config`, a mutex for thread safety, backup status state, and a map of remote `Target` interfaces.
- **Backup storage**: Tar.gz archives created from `filepath.Walk` of the mihomo working directory. Stored in a configurable `backup_dir` (defaults to `{working_dir}/backups/`).
- **Retention policy**: Configurable `max_backups` (count-based) and `max_age_days` (age-based). Backups sorted newest-first, oldest pruned first.
- **Target abstraction** (`target.go`): `Target` interface with `Name()`, `Type()`, `TestConnection()`, `Upload()`, `List()`, `Delete()`, `GetLastSync()`. Factory `NewTarget()` dispatches by target type.
- **WebDAV implementation** (`webdav.go`): `webdavTarget` implements `Target` for WebDAV servers with PROPFIND XML parsing, basic auth, upload/download, list, and HTTP client timeouts.

## Flow
1. **CreateBackup(source)**: Create tar.gz in backup dir → walk working dir → write files → update status → return entry.
2. **ApplyRetention()**: List backups → sort by mod time → prune by age cutoff (`max_age_days`) → prune by count (`max_backups`) → return deleted count.
3. **SyncToRemote(targetName, filename)**: Find target in target map → open local backup archive → call `target.Upload()`.
4. **ListBackups()**: Read backup directory → filter `.tar.gz` files → sort by creation date descending → update status totals.

## Integration
- **Depends on**: `pkg/config.Config` (working dir, backup config, remote target config), `pkg/logger`.
- **Consumed by**: `internal/http/handler/backup.BackupHandler`, `internal/http/handler/backup.RemoteTargetHandler`.
- **Implements**: Backup management service for backup automation, retention, and remote sync targets.

# backend/internal/service/backup/

## Responsibility
Backup service layer — manages the complete backup lifecycle including creation, listing, restoration, deletion, retention policy enforcement, and remote target synchronization. Encapsulates all backup business logic separate from HTTP handlers.

## Design
- **Service struct pattern**: `Service` holds `*config.Config`, a mutex for thread safety, backup status state, and a map of remote `Target` interfaces.
- **Backup storage**: Tar.gz archives created from `filepath.Walk` of the mihomo working directory. Stored in a configurable `backup_dir` (defaults to `{working_dir}/backups/`).
- **Retention policy**: Configurable `max_backups` (count-based) and `max_age_days` (age-based). Backups sorted newest-first, oldest pruned first.
- **Target abstraction**: `Target` interface (`target.go`) with `Name()`, `Type()`, `TestConnection()`, `Upload()`, `List()`, `Delete()`, `GetLastSync()`. Factory `NewTarget()` dispatches by type.
- **WebDAV implementation**: `webdav.go` implements `Target` for WebDAV servers with PROPFIND XML parsing, basic auth, and HTTP client timeout.

## Flow
1. **CreateBackup(source)**: Create tar.gz in backup dir → walk working dir → write files → update status → return entry.
2. **ApplyRetention()**: List backups → sort by mod time → prune by age cutoff → prune by count → return deleted count.
3. **SyncToRemote(name, filename)**: Find target → open local backup → `target.Upload()`.
4. **ListBackups()**: Read backup dir → filter `.tar.gz` → sort by created desc → update status totals.

## Integration
- **Depends on**: `pkg/config.Config` (working dir, backup config, remote target config), `internal/service/backup.Target` interface.
- **Consumed by**: `internal/http/handler/backup.BackupHandler`, `internal/http/handler/backup.RemoteTargetHandler`.
- **Implements**: Backup service for M6 milestone (automation, retention, remote targets).

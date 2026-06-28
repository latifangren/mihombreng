# handler/backup/

## Responsibility
HTTP handlers for the complete backup lifecycle: creation, listing, restoration, deletion, retention policy enforcement, backup status monitoring, and remote backup target operations. Delegates all business logic to `internal/service/backup.Service`.

## Design
- **Two handler structs**: `BackupHandler` (local backup ops) and `RemoteTargetHandler` (remote target ops), both wrapping `*config.Config` and `*backup.Service`.
- **Service delegation**: All logic moved from handler to `backup.Service` in M6 refactor. Handlers are thin HTTP adapters.
- **Pre-restore safety**: Both `RestoreBackup` and `RestoreBackupFromHistory` auto-create a backup before restoring.
- **Remote target operations**: `RemoteTargetHandler` provides list, test connectivity, sync, sync status, and upload to remote targets.

## Endpoints
| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| GET | `/backup/list` | `ListBackups` | List local backups |
| POST | `/backup/create` | `CreateBackup` | Create new backup |
| POST | `/backup/restore` | `RestoreBackup` | Restore from uploaded file |
| POST | `/backup/restore/:filename` | `RestoreBackupFromHistory` | Restore from history |
| DELETE | `/backup/:filename` | `DeleteBackup` | Delete a backup |
| GET | `/backup/status` | `GetBackupStatus` | Get backup status/metrics |
| POST | `/backup/retention` | `ApplyRetention` | Trigger retention cleanup |
| GET | `/backup/remote/list` | `ListTargets` | List remote targets |
| POST | `/backup/remote/test/:name` | `TestTarget` | Test remote connectivity |
| POST | `/backup/remote/sync/:name` | `SyncToRemote` | Sync latest backup to remote |
| GET | `/backup/remote/status/:name` | `GetSyncStatus` | Get remote sync status |
| POST | `/backup/remote/upload/:name/:filename` | `UploadToRemote` | Upload specific backup to remote |

## Flow
- **CreateBackup**: `service.CreateBackup("manual")` → `service.ApplyRetention()` → return entry + retention stats.
- **RestoreBackup**: `service.CreateBackup("pre-restore")` → save upload to temp → `service.RestoreFromUpload()`.
- **SyncToRemote**: `service.SyncToRemote(name, filename)` → if no filename, uses latest backup.
- **TestTarget**: `service.TestRemoteTarget(name)` → returns connection test result string.

## Integration
- **Depends on**: `pkg/config.Config`, `internal/service/backup.Service`.
- **Consumed by**: `router.Setup()` registers all routes under `/api/v1/backup/`.

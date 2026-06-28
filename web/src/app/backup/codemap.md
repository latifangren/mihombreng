# app/backup/

## Responsibility
Backup management workspace — provides history-aware backup and restore with status monitoring, retention policy controls, and remote backup target management. Full lifecycle: create, list, restore (upload or history), delete, retention cleanup, remote sync.

## Design
- **Client-rendered page**: `"use client"` directive, single `BackupPage` component.
- **State management**: Local state for history list, status, remote targets, sync statuses, selection, confirmation dialogs.
- **API-driven**: Fetches from `/api/v1/backup/list` and `/api/v1/backup/status` on mount.
- **Backup Status Card**: Displays total backups, total size, last backup time/source, retention trigger button.
- **Remote Backup Targets Card**: Lists configured targets (name, type, URL, enabled), test connection, sync now, last sync status.
- **Backup History**: List of backups with restore/delete actions per item.
- **Create/Restore Cards**: Manual backup creation and upload-based restore.
- **Pre-restore safety**: Warning about overwrites, confirmation dialogs for all destructive actions.

## Flow
1. Page mounts → `loadHistory()` → `backupApi.list()` + `backupApi.status()` → populate state.
2. `loadRemoteTargets()` → `backupApi.listRemoteTargets()` → for each target, load sync status.
3. User creates backup → `backupApi.create()` → toast + reload history.
4. User applies retention → `backupApi.applyRetention()` → toast with deleted count + reload.
5. User tests remote target → `backupApi.testRemoteTarget(name)` → toast result.
6. User syncs to remote → `backupApi.syncToRemote(name)` → toast + reload remote statuses.

## Integration
- **Services**: `services/api` → `backupApi.*` (list, create, restore, restoreFromHistory, remove, status, applyRetention, listRemoteTargets, testRemoteTarget, syncToRemote, getRemoteSyncStatus)
- **Types**: `BackupEntry`, `BackupStatus`, `RemoteBackupTarget`, `RemoteSyncStatus`
- **Components**: `ui/card`, `ui/retro-btn`
- **Icons**: `lucide-react` (AlertTriangle, Clock, Database, Download, History, RefreshCcw, RotateCcw, Shield, Trash2, Upload)
- **Notifications**: `react-hot-toast`

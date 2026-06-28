"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useModalAccessibility } from "@/hooks/use-modal-accessibility";
import { Card } from "@/components/ui/card";
import { DataState, FreshnessPill } from "@/components/ui/data-state";
import { RetroBtn } from "@/components/ui/retro-btn";
import { Skeleton } from "@/components/ui/skeleton";
import { backupApi } from "@/services/api";
import type { BackupEntry, BackupStatus, RemoteBackupTarget, RemoteSyncStatus } from "@/types";
import {
  AlertTriangle,
  Calendar,
  Clock,
  Database,
  Download,
  FileArchive,
  HardDrive,
  History,
  RefreshCcw,
  RotateCcw,
  Shield,
  ShieldOff,
  Trash2,
  Upload,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ------------------------------------------------------------------ */
/*  Skeleton placeholders                                             */
/* ------------------------------------------------------------------ */

function HistorySkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-[12px] border-2 border-black bg-black/15 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1 space-y-2">
              <Skeleton width="220px" height="14px" />
              <Skeleton width="160px" height="11px" />
              <Skeleton width="100px" height="10px" />
            </div>
            <div className="flex gap-2">
              <Skeleton width="90px" height="30px" />
              <Skeleton width="80px" height="30px" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RemoteTargetSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="rounded-[12px] border-2 border-black bg-black/15 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1 space-y-2">
              <Skeleton width="140px" height="14px" />
              <Skeleton width="280px" height="10px" />
              <Skeleton width="180px" height="10px" />
            </div>
            <div className="flex gap-2">
              <Skeleton width="110px" height="30px" />
              <Skeleton width="80px" height="30px" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                         */
/* ------------------------------------------------------------------ */

export default function BackupPage() {
  const [createLoading, setCreateLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [history, setHistory] = useState<BackupEntry[]>([]);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedHistory, setSelectedHistory] = useState<BackupEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BackupEntry | null>(null);
  const [confirmMode, setConfirmMode] = useState<"upload" | "history" | "delete" | null>(null);
  const confirmModalRef = useModalAccessibility(!!confirmMode, () => resetDialogs());
  const [retentionLoading, setRetentionLoading] = useState(false);
  const [remoteTargets, setRemoteTargets] = useState<RemoteBackupTarget[]>([]);
  const [remoteTargetsLoading, setRemoteTargetsLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState<string | null>(null);
  const [syncStatuses, setSyncStatuses] = useState<Record<string, RemoteSyncStatus>>({});
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const items = await backupApi.list();
      setHistory(items);
      const s = await backupApi.status();
      setStatus(s);
      setLastLoadedAt(new Date());
    } catch (err) {
      console.error(err);
      setHistoryError("Failed to load backup history");
      toast.error("Failed to load backup history");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadRemoteTargets = useCallback(async () => {
    setRemoteTargetsLoading(true);
    setRemoteError(null);
    try {
      const targets = await backupApi.listRemoteTargets();
      setRemoteTargets(targets);
      // Load sync statuses
      for (const t of targets) {
        const s = await backupApi.getRemoteSyncStatus(t.name);
        setSyncStatuses((prev) => ({ ...prev, [t.name]: s }));
      }
    } catch (err) {
      console.error(err);
      setRemoteError("Failed to load remote targets");
      toast.error("Failed to load remote targets");
    } finally {
      setRemoteTargetsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
    void loadRemoteTargets();
  }, [loadHistory, loadRemoteTargets]);

  const handleCreate = async () => {
    setCreateLoading(true);
    try {
      const entry = await backupApi.create();
      await backupApi.download(entry.filename);
      toast.success("Backup downloaded");
      await loadHistory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Backup failed");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".tar.gz")) {
      toast.error("Please select a .tar.gz file");
      return;
    }
    setSelectedFile(file);
    setConfirmMode("upload");
  };

  const resetDialogs = () => {
    setConfirmMode(null);
    setSelectedFile(null);
    setSelectedHistory(null);
    setDeleteTarget(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const confirmUploadRestore = async () => {
    if (!selectedFile) return;
    setRestoreLoading(true);
    try {
      await backupApi.restore(selectedFile);
      toast.success("Backup restored — restart Mihomo to apply");
      await loadHistory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setRestoreLoading(false);
      resetDialogs();
    }
  };

  const confirmHistoryRestore = async () => {
    if (!selectedHistory) return;
    setRestoreLoading(true);
    try {
      await backupApi.restoreFromHistory(selectedHistory.filename);
      toast.success("Backup restored from history");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setRestoreLoading(false);
      resetDialogs();
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await backupApi.remove(deleteTarget.filename);
      toast.success("Backup deleted");
      await loadHistory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      resetDialogs();
    }
  };

  const handleApplyRetention = async () => {
    setRetentionLoading(true);
    try {
      const deleted = await backupApi.applyRetention();
      toast.success(`Retention applied: ${deleted} backups removed`);
      await loadHistory();
    } catch (err) {
      console.error(err);
      toast.error("Retention failed");
    } finally {
      setRetentionLoading(false);
    }
  };

  /* -------------------------------------------------------------- */
  /*  Confirm dialog content helpers                                 */
  /* -------------------------------------------------------------- */

  const activeFilename =
    selectedFile?.name || selectedHistory?.filename || deleteTarget?.filename || "";
  const activeSize =
    selectedFile?.size || selectedHistory?.size || 0;

  const confirmTitle =
    confirmMode === "delete" ? "Confirm Delete" : "Confirm Restore";
  const confirmDesc =
    confirmMode === "delete"
      ? "This permanently removes the backup. You cannot undo this."
      : "This overwrites your current working directory configuration with the backup below.";
  const confirmWarning =
    confirmMode === "delete"
      ? "Only delete if this backup is no longer needed."
      : "Create a fresh backup first if you may need to roll back again.";

  return (
    <div className="relative">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="floating-shape-slow absolute -left-10 top-20 h-40 w-40 rounded-full border-2 border-primary/10" />
        <div className="floating-shape absolute right-20 top-40 h-24 w-24 rounded-full border-2 border-warning/10" />
      </div>

      <div className="relative z-10 space-y-8">
        {/* ── Hero header ── */}
        <div className="relative overflow-hidden rounded-[16px] border-2 border-black bg-surface p-5 shadow-[8px_8px_0_#000]">
          <div className="absolute right-[-70px] top-[-70px] h-44 w-44 rounded-full border-2 border-black bg-primary/10" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-heading text-2xl uppercase tracking-wide text-text">Backup</h1>
                <FreshnessPill
                  loading={historyLoading}
                  error={historyError}
                  lastUpdatedAt={lastLoadedAt}
                  stale={Boolean(historyError && history.length > 0)}
                />
              </div>
              <p className="mt-2 font-mono text-xs uppercase tracking-wider text-text-muted">
                History-aware backup and restore workspace
              </p>
              <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-2">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Backup posture</p>
                  <p className={`font-heading text-4xl uppercase tracking-wide ${
                    historyError ? "text-danger" :
                    history.length === 0 ? "text-text" :
                    status && status.last_backup_time ? "text-primary" : "text-warning"
                  }`}>
                    {historyError ? "Index stale" :
                     history.length === 0 ? "No backups" :
                     status && status.last_backup_time ? "Backups ready" : "Create first"}
                  </p>
                </div>
                <div className="pb-1 font-mono text-xs text-text-muted">
                  {status ? `${status.backup_count} total / ${formatBytes(status.total_size_bytes)} stored` : "Loading..."}
                </div>
              </div>
            </div>
            <RetroBtn
              variant="ghost"
              size="sm"
              onClick={() => void loadHistory()}
              loading={historyLoading}
            >
              <RefreshCcw className="mr-1.5 inline-block h-3.5 w-3.5" />
              Refresh
            </RetroBtn>
          </div>
        </div>

        {historyError && (
          <DataState
            tone="danger"
            title={history.length > 0 ? "Backup index stale" : "Backup history unavailable"}
            message={history.length > 0 ? `Keeping the last backup history visible. Backend said: ${historyError}` : historyError}
            action={<RetroBtn size="sm" variant="ghost" onClick={() => void loadHistory()} loading={historyLoading}>Retry</RetroBtn>}
          />
        )}

        {/* ── Backup Status ── */}
        {status && (
          <Card title="Backup Status" icon={<Clock className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-[10px] border border-black/70 bg-black/15 px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Total Backups</p>
                <p className="mt-1 font-heading text-2xl text-text">{status.backup_count}</p>
              </div>
              <div className="rounded-[10px] border border-black/70 bg-black/15 px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Total Size</p>
                <p className="mt-1 font-heading text-2xl text-text">{formatBytes(status.total_size_bytes)}</p>
              </div>
              <div className="rounded-[10px] border border-black/70 bg-black/15 px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Last Backup</p>
                {status.last_backup_time ? (
                  <p className="mt-1 font-heading text-sm text-text">{new Date(status.last_backup_time).toLocaleString()}</p>
                ) : (
                  <p className="mt-1 font-heading text-sm text-text-muted">Never</p>
                )}
                {status.last_backup_source && (
                  <p className="mt-0.5 font-mono text-[10px] text-text-muted">Source: {status.last_backup_source}</p>
                )}
              </div>
              <div className="rounded-[10px] border border-black/70 bg-black/15 px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Retention</p>
                <div className="mt-1">
                  <RetroBtn
                    size="sm"
                    variant="warning"
                    onClick={() => void handleApplyRetention()}
                    loading={retentionLoading}
                  >
                    <Shield className="mr-1.5 inline-block h-3.5 w-3.5" />
                    Apply Now
                  </RetroBtn>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* ── Remote Backup Targets ── */}
        <Card title="Remote Targets" icon={<Database className="h-4 w-4" />}>
          {remoteTargetsLoading ? (
            <RemoteTargetSkeleton />
          ) : remoteError ? (
            <DataState
              tone="danger"
              icon={<AlertTriangle className="h-4 w-4" />}
              title="Could not load remote targets"
              message={remoteError}
              action={
                <RetroBtn
                  size="sm"
                  variant="ghost"
                  onClick={() => void loadRemoteTargets()}
                >
                  Retry
                </RetroBtn>
              }
            />
          ) : remoteTargets.length === 0 ? (
            <DataState
              tone="neutral"
              icon={<Database className="h-4 w-4" />}
              title="No remote targets configured"
              message="Configure a WebDAV target in your config file to enable remote backup sync."
            />
          ) : (
            <div className="space-y-3">
              {remoteTargets.map((target) => {
                const sync = syncStatuses[target.name];
                const hasError = Boolean(sync?.last_sync_error);
                return (
                  <div
                    key={target.name}
                    className="rounded-[12px] border-2 border-black bg-black/15 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-heading text-sm uppercase tracking-wide text-text">
                            {target.name}
                          </p>
                          <span className="rounded-[4px] border border-border px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                            {target.type}
                          </span>
                          {target.enabled ? (
                            <span className="inline-flex items-center gap-1 rounded-[4px] border border-success bg-success/10 px-1.5 py-0.5 font-mono text-[10px] text-success">
                              <Zap className="h-2.5 w-2.5" /> Enabled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-[4px] border border-text-muted bg-text-muted/10 px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                              <ShieldOff className="h-2.5 w-2.5" /> Disabled
                            </span>
                          )}
                        </div>
                        <p className="mt-2 break-all font-mono text-xs text-text-muted">
                          {target.url}
                        </p>
                        {sync && (
                          <div className="mt-2 space-y-1">
                            <p className="font-mono text-[10px] text-text-muted">
                              Last sync:{" "}
                              {sync.last_sync_time
                                ? `${relativeTime(sync.last_sync_time)} · ${new Date(sync.last_sync_time).toLocaleString()}`
                                : "Never"}
                            </p>
                            <p className="font-mono text-[10px] text-text-muted">
                              Synced: {sync.sync_count} time{sync.sync_count !== 1 ? "s" : ""} · Uploaded: {formatBytes(sync.total_uploaded)}
                            </p>
                            {hasError && (
                              <p className="rounded-[6px] border border-danger/40 bg-danger/10 px-2 py-1 font-mono text-[10px] text-danger">
                                {sync.last_sync_error}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <RetroBtn
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setTestLoading(target.name);
                            void backupApi
                              .testRemoteTarget(target.name)
                              .then((result) => {
                                toast.success(result.result);
                              })
                              .catch(() => {
                                toast.error("Test failed");
                              })
                              .finally(() => {
                                setTestLoading(null);
                              });
                          }}
                          loading={testLoading === target.name}
                        >
                          Test
                        </RetroBtn>
                        <RetroBtn
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            setSyncLoading(target.name);
                            void backupApi
                              .syncToRemote(target.name)
                              .then((filename) => {
                                toast.success(`Synced: ${filename}`);
                                void loadRemoteTargets();
                              })
                              .catch(() => {
                                toast.error("Sync failed");
                              })
                              .finally(() => {
                                setSyncLoading(null);
                              });
                          }}
                          loading={syncLoading === target.name}
                          disabled={!target.enabled}
                        >
                          Sync Now
                        </RetroBtn>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* ── History + Actions grid ── */}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          {/* History */}
          <div className="space-y-6">
            <Card title="Backup History" icon={<History className="h-4 w-4" />}>
              {historyLoading ? (
                <HistorySkeleton />
              ) : historyError ? (
                <DataState
                  tone="danger"
                  icon={<AlertTriangle className="h-4 w-4" />}
                  title="Could not load backup history"
                  message={historyError}
                  action={
                    <RetroBtn
                      size="sm"
                      variant="ghost"
                      onClick={() => void loadHistory()}
                    >
                      Retry
                    </RetroBtn>
                  }
                />
              ) : history.length === 0 ? (
                <DataState
                  tone="neutral"
                  icon={<FileArchive className="h-4 w-4" />}
                  title="No backups yet"
                  message="Create your first backup using the panel on the right. Backups are stored locally in the working directory."
                />
              ) : (
                <div className="space-y-3">
                  {history.map((entry) => (
                    <div
                      key={entry.filename}
                      className="rounded-[12px] border-2 border-black bg-black/15 p-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="break-all font-heading text-sm uppercase tracking-wide text-text">
                            {entry.filename}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-text-muted">
                              <HardDrive className="h-2.5 w-2.5" />
                              {formatBytes(entry.size)}
                            </span>
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-text-muted">
                              <Calendar className="h-2.5 w-2.5" />
                              {entry.created}
                            </span>
                            {entry.source && (
                              <span className="inline-flex items-center gap-1 rounded-[4px] border border-border px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
                                {entry.source}
                              </span>
                            )}
                            <span className="font-mono text-[10px] text-text-muted">
                              {relativeTime(entry.created)}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <RetroBtn
                            size="sm"
                            variant="warning"
                            onClick={() => {
                              setSelectedHistory(entry);
                              setConfirmMode("history");
                            }}
                          >
                            <RotateCcw className="mr-1.5 inline-block h-3.5 w-3.5" />
                            Restore
                          </RetroBtn>
                          <RetroBtn
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              setDeleteTarget(entry);
                              setConfirmMode("delete");
                            }}
                          >
                            <Trash2 className="mr-1.5 inline-block h-3.5 w-3.5" />
                            Delete
                          </RetroBtn>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Actions sidebar */}
          <div className="space-y-6">
            <Card title="Create Backup" icon={<Download className="h-4 w-4" />}>
              <p className="mb-4 font-mono text-sm text-text-muted">
                Download a complete backup of configs and providers. Refresh
                history after to confirm.
              </p>
              <RetroBtn onClick={handleCreate} disabled={createLoading}>
                <Download className="mr-1.5 inline-block h-4 w-4" />
                {createLoading ? "Creating…" : "Create Backup"}
              </RetroBtn>
            </Card>

            <Card
              title="Restore from Upload"
              icon={<Upload className="h-4 w-4" />}
            >
              <p className="mb-4 font-mono text-sm text-text-muted">
                Upload a .tar.gz backup file. If the backup is already on the
                server, use History restore instead.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".tar.gz"
                onChange={handleFileChange}
                className="hidden"
              />
              <RetroBtn
                variant="warning"
                onClick={() => fileInputRef.current?.click()}
                disabled={restoreLoading}
              >
                <Upload className="mr-1.5 inline-block h-4 w-4" />
                {restoreLoading ? "Restoring…" : "Choose Backup File"}
              </RetroBtn>
              {selectedFile && confirmMode !== "upload" && (
                <div className="mt-3 rounded-[8px] border border-border bg-black/20 px-3 py-2">
                  <p className="font-mono text-xs text-text-muted">
                    <FileArchive className="mr-1 inline-block h-3 w-3" />
                    {selectedFile.name}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-text-muted">
                    {formatBytes(selectedFile.size)}
                  </p>
                </div>
              )}
            </Card>

            {/* Safety warning */}
            <div className="rounded-[12px] border-2 border-warning bg-warning/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
                <div>
                  <p className="font-heading text-xs font-semibold uppercase tracking-wider text-warning">
                    Restore Overwrites Working Directory
                  </p>
                  <p className="mt-1 font-mono text-[11px] leading-relaxed text-text-muted">
                    Restoring replaces files inside the working directory. Always
                    create a fresh backup before risky config changes so you can
                    roll back.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Confirm modal ── */}
        {confirmMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div ref={confirmModalRef} className="mx-4 w-full max-w-md rounded-[12px] border-2 border-black bg-surface p-6 shadow-[8px_8px_0_#000] outline-none">
              {/* Header */}
              <div className="mb-4 flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-[8px] border-2 border-black ${
                    confirmMode === "delete"
                      ? "bg-danger/15"
                      : "bg-warning/15"
                  }`}
                >
                  {confirmMode === "delete" ? (
                    <Trash2 className="h-4 w-4 text-danger" />
                  ) : (
                    <RotateCcw className="h-4 w-4 text-warning" />
                  )}
                </div>
                <h3 className="font-heading text-lg uppercase tracking-wide text-text">
                  {confirmTitle}
                </h3>
              </div>

              {/* Description */}
              <p className="mb-3 font-mono text-xs leading-relaxed text-text-muted">
                {confirmDesc}
              </p>

              {/* Target file */}
              <div className="mb-3 rounded-[8px] border-2 border-border bg-black/30 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <FileArchive className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                  <p className="break-all font-mono text-xs text-primary">
                    {activeFilename}
                  </p>
                </div>
                {activeSize > 0 && (
                  <p className="mt-1 pl-5.5 font-mono text-[10px] text-text-muted">
                    {formatBytes(activeSize)}
                  </p>
                )}
                {selectedHistory?.source && (
                  <p className="mt-0.5 pl-5.5 font-mono text-[10px] text-text-muted">
                    Source: {selectedHistory.source}
                  </p>
                )}
                {deleteTarget?.source && (
                  <p className="mt-0.5 pl-5.5 font-mono text-[10px] text-text-muted">
                    Source: {deleteTarget.source}
                  </p>
                )}
              </div>

              {/* Safety note */}
              <div className={`mb-5 flex items-start gap-2 rounded-[8px] px-3 py-2 ${
                confirmMode === "delete"
                  ? "border-2 border-danger/40 bg-danger/10"
                  : "border-2 border-warning/40 bg-warning/10"
              }`}>
                {confirmMode === "delete" ? (
                  <Trash2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-danger" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warning" />
                )}
                <p className={`font-mono text-[11px] leading-relaxed ${confirmMode === "delete" ? "text-danger" : "text-text-muted"}`}>
                  {confirmWarning}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                {confirmMode === "upload" && (
                  <RetroBtn
                    variant="danger"
                    onClick={() => void confirmUploadRestore()}
                    loading={restoreLoading}
                  >
                    Overwrite &amp; Restore
                  </RetroBtn>
                )}
                {confirmMode === "history" && (
                  <RetroBtn
                    variant="danger"
                    onClick={() => void confirmHistoryRestore()}
                    loading={restoreLoading}
                  >
                    Restore from History
                  </RetroBtn>
                )}
                {confirmMode === "delete" && (
                  <RetroBtn
                    variant="danger"
                    onClick={() => void confirmDelete()}
                  >
                    Permanently Delete
                  </RetroBtn>
                )}
                <RetroBtn variant="ghost" onClick={resetDialogs}>
                  Cancel
                </RetroBtn>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

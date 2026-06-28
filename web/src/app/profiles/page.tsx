"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useModalAccessibility } from "@/hooks/use-modal-accessibility";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataState, FreshnessPill } from "@/components/ui/data-state";
import { RetroBtn } from "@/components/ui/retro-btn";
import { Skeleton } from "@/components/ui/skeleton";
import { subscriptionApi } from "@/services/api";
import type { SubscriptionProfile, SubscriptionProfileInput } from "@/types";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Edit3,
  ExternalLink,
  FileStack,
  Link2,
  PauseCircle,
  Plus,
  RefreshCcw,
  Search,
  ServerCrash,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

const DEFAULT_FORM: SubscriptionProfileInput = {
  name: "",
  url: "",
  provider_filename: "",
  update_interval: 3600,
  enabled: true,
};

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatInterval(seconds: number) {
  if (!seconds) return "Manual";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

function statusTone(status: string): "success" | "warning" | "danger" | "info" | "default" {
  if (status === "healthy") return "success";
  if (status === "error") return "danger";
  if (status === "draft") return "warning";
  if (status === "refreshing") return "info";
  return "default";
}

function statusCopy(profile: SubscriptionProfile) {
  if (!profile.enabled) return "Paused by operator";
  if (profile.status === "healthy") return "Fetch and parse path is clean";
  if (profile.status === "error") return profile.last_error || "Refresh failed";
  if (profile.status === "draft") return "Created, waiting for first clean refresh";
  if (profile.status === "refreshing") return "Refresh in progress";
  return "No health signal reported";
}

function inferProviderFilename(name: string) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug ? `${slug}.yaml` : "";
}

function ProfileSkeleton() {
  return (
    <div className="space-y-3">
      {["feed-a", "feed-b", "feed-c"].map((key) => (
        <div key={key} className="rounded-[14px] border-2 border-black bg-black/10 p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton width="220px" height="16px" />
              <Skeleton width="160px" height="12px" />
              <Skeleton width="100%" height="12px" />
            </div>
            <Skeleton width="160px" height="32px" />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <Skeleton height="58px" />
            <Skeleton height="58px" />
            <Skeleton height="58px" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MetaTile({ label, value, tone = "text-text", detail }: { label: string; value: ReactNode; tone?: string; detail?: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-black/70 bg-black/15 px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{label}</p>
      <div className={`mt-1 break-words font-heading text-lg ${tone}`}>{value}</div>
      {detail && <div className="mt-1 break-words font-mono text-[11px] text-text-muted">{detail}</div>}
    </div>
  );
}

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const containerRef = useModalAccessibility(open, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div ref={containerRef} className="w-full max-w-2xl rounded-[16px] border-2 border-black bg-surface p-5 shadow-[8px_8px_0_#000] outline-none">
        <div className="mb-4 flex items-center justify-between gap-3 border-b-2 border-black/70 pb-3">
          <h3 className="font-heading text-lg uppercase tracking-wide text-text">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border-2 border-black bg-black/10 p-1.5 text-text-muted transition-colors hover:bg-black/20 hover:text-text"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<SubscriptionProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingList, setRefreshingList] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [deleteTarget, setDeleteTarget] = useState<SubscriptionProfile | null>(null);
  const [form, setForm] = useState<SubscriptionProfileInput>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadProfiles = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "init") setLoading(true);
    if (mode === "refresh") setRefreshingList(true);
    try {
      const items = await subscriptionApi.list();
      setProfiles(items);
      setSelectedId((prev) => (prev && items.some((item) => item.id === prev) ? prev : items[0]?.id ?? null));
      setLastLoadedAt(new Date());
      setPageError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load subscriptions";
      setPageError(message);
      toast.error(message);
    } finally {
      if (mode === "init") setLoading(false);
      if (mode === "refresh") setRefreshingList(false);
    }
  }, []);

  useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  const filteredProfiles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return profiles.filter((profile) => {
      if (!needle) return true;
      return [profile.name, profile.provider_filename, profile.url, profile.status]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [profiles, query]);

  const selected = useMemo(
    () => profiles.find((profile) => profile.id === selectedId) ?? filteredProfiles[0] ?? null,
    [profiles, filteredProfiles, selectedId]
  );

  useEffect(() => {
    if (!selected && filteredProfiles.length > 0) {
      setSelectedId(filteredProfiles[0].id);
    }
  }, [selected, filteredProfiles]);

  const counts = useMemo(() => {
    const enabled = profiles.filter((item) => item.enabled).length;
    const disabled = profiles.length - enabled;
    const healthy = profiles.filter((item) => item.status === "healthy").length;
    const errors = profiles.filter((item) => item.status === "error").length;
    const proxies = profiles.reduce((sum, item) => sum + item.proxy_count, 0);
    const lastSuccess = profiles
      .map((item) => item.last_success_at)
      .filter(Boolean)
      .sort()
      .at(-1);
    return { enabled, disabled, healthy, errors, proxies, lastSuccess };
  }, [profiles]);

  const posture = counts.errors > 0 ? "Needs attention" : profiles.length === 0 ? "No feeds" : counts.healthy === counts.enabled ? "Feeds steady" : "Partially ready";
  const postureTone = counts.errors > 0 ? "text-danger" : profiles.length === 0 ? "text-text" : counts.healthy === counts.enabled ? "text-primary" : "text-warning";

  const openCreate = () => {
    setEditorMode("create");
    setForm(DEFAULT_FORM);
    setEditorOpen(true);
  };

  const openEdit = (profile: SubscriptionProfile) => {
    setEditorMode("edit");
    setSelectedId(profile.id);
    setForm({
      name: profile.name,
      url: profile.url,
      provider_filename: profile.provider_filename,
      update_interval: profile.update_interval,
      enabled: profile.enabled,
    });
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setSaving(false);
  };

  const updateForm = <K extends keyof SubscriptionProfileInput>(key: K, value: SubscriptionProfileInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submitEditor = async () => {
    setSaving(true);
    try {
      if (editorMode === "create") {
        const created = await subscriptionApi.create(form);
        toast.success("Subscription profile created");
        setSelectedId(created.id);
      } else if (selected) {
        const updated = await subscriptionApi.update(selected.id, form);
        toast.success("Subscription profile updated");
        setSelectedId(updated.id);
      }
      closeEditor();
      await loadProfiles("refresh");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async (profile: SubscriptionProfile) => {
    setRefreshingId(profile.id);
    try {
      const refreshed = await subscriptionApi.refresh(profile.id);
      setProfiles((prev) => prev.map((item) => (item.id === refreshed.id ? refreshed : item)));
      setSelectedId(refreshed.id);
      setLastLoadedAt(new Date());
      toast.success(refreshed.status === "healthy" ? "Subscription refreshed" : "Refresh finished with errors");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await subscriptionApi.remove(deleteTarget.id);
      toast.success("Subscription deleted");
      setDeleteTarget(null);
      await loadProfiles("refresh");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="relative">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="floating-shape absolute left-[14%] top-24 h-20 w-20 rounded-full border border-primary/20" />
        <div className="floating-shape-slow absolute right-[10%] top-52 h-36 w-36 rounded-full border-2 border-warning/10" />
      </div>

      <div className="relative z-10 space-y-6">
        <div className="relative overflow-hidden rounded-[16px] border-2 border-black bg-surface p-5 shadow-[8px_8px_0_#000]">
          <div className="absolute right-[-70px] top-[-70px] h-44 w-44 rounded-full border-2 border-black bg-warning/10" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-heading text-2xl uppercase tracking-wide text-text">Profiles</h1>
                <FreshnessPill loading={loading || refreshingList} error={pageError} lastUpdatedAt={lastLoadedAt} stale={Boolean(pageError && profiles.length > 0)} />
              </div>
              <p className="mt-2 font-mono text-xs uppercase tracking-wider text-text-muted">
                Operator workspace for subscription-backed proxy profiles
              </p>
              <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-2">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Subscription posture</p>
                  <p className={`font-heading text-4xl uppercase tracking-wide ${postureTone}`}>{posture}</p>
                </div>
                <div className="pb-1 font-mono text-xs text-text-muted">
                  {counts.enabled} live / {counts.disabled} paused / {counts.proxies} imported proxies
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <RetroBtn variant="ghost" onClick={() => void loadProfiles("refresh")} loading={refreshingList}>
                <RefreshCcw className="mr-1.5 inline-block h-4 w-4" />
                Refresh List
              </RetroBtn>
              <RetroBtn onClick={openCreate}>
                <Plus className="mr-1.5 inline-block h-4 w-4" />
                New Profile
              </RetroBtn>
            </div>
          </div>
        </div>

        {pageError && (
          <DataState
            tone="danger"
            icon={<ServerCrash className="h-4 w-4" />}
            title={profiles.length > 0 ? "Profile list stale" : "Profiles unavailable"}
            message={profiles.length > 0 ? `Keeping last loaded subscriptions visible. Backend said: ${pageError}` : pageError}
            action={
              <RetroBtn size="sm" variant="ghost" onClick={() => void loadProfiles("refresh")} loading={refreshingList}>
                Retry
              </RetroBtn>
            }
          />
        )}

        <div className="grid gap-4 md:grid-cols-4">
          <Card title="Total Profiles" className="p-4">
            <div className="font-heading text-3xl text-text">{loading ? "—" : profiles.length}</div>
          </Card>
          <Card title="Enabled" className="p-4">
            <div className="font-heading text-3xl text-primary">{loading ? "—" : counts.enabled}</div>
          </Card>
          <Card title="Healthy Feeds" className="p-4">
            <div className="font-heading text-3xl text-info">{loading ? "—" : counts.healthy}</div>
          </Card>
          <Card title="Imported Proxies" className="p-4">
            <div className="font-heading text-3xl text-warning">{loading ? "—" : counts.proxies}</div>
            <p className="mt-1 font-mono text-[11px] text-text-muted">Last success: {formatDate(counts.lastSuccess)}</p>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <div className="space-y-6">
            <Card
              title="Profile Queue"
              icon={<FileStack className="h-4 w-4" />}
              action={<Badge variant={counts.errors > 0 ? "danger" : "default"}>{counts.errors} errors</Badge>}
            >
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <label className="flex flex-1 items-center gap-2 rounded-[12px] border-2 border-black bg-black/10 px-3 py-2">
                  <Search className="h-4 w-4 text-text-muted" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name, file, status, or source URL"
                    className="w-full bg-transparent font-mono text-sm text-text outline-none placeholder:text-text-muted"
                  />
                </label>
                <div className="font-mono text-xs uppercase tracking-widest text-text-muted">
                  {filteredProfiles.length} visible
                </div>
              </div>

              {loading ? (
                <ProfileSkeleton />
              ) : filteredProfiles.length === 0 ? (
                <DataState
                  tone={profiles.length === 0 ? "neutral" : "warning"}
                  icon={profiles.length === 0 ? <FileStack className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                  title={profiles.length === 0 ? "No subscription profiles" : "No matching profiles"}
                  message={
                    profiles.length === 0
                      ? "Create the first subscription profile to generate a provider file and pull proxy count."
                      : "Clear the search or look up the provider filename/source URL directly."
                  }
                  action={profiles.length === 0 ? <RetroBtn size="sm" onClick={openCreate}>Create Profile</RetroBtn> : undefined}
                />
              ) : (
                <div className="space-y-3">
                  {filteredProfiles.map((profile) => {
                    const active = selected?.id === profile.id;
                    const busy = refreshingId === profile.id;
                    const tone = statusTone(profile.status);
                    return (
                      <div
                        key={profile.id}
                        className={`rounded-[14px] border-2 p-4 transition-all ${
                          active ? "border-primary bg-primary/10 shadow-[6px_6px_0_#000]" : "border-black bg-black/10 hover:bg-black/20"
                        }`}
                      >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <button
                            type="button"
                            onClick={() => setSelectedId(profile.id)}
                            className="min-w-0 text-left"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="break-all font-heading text-sm uppercase tracking-wide text-text">{profile.name}</p>
                              <Badge variant={tone}>{profile.status || "unknown"}</Badge>
                              {profile.enabled ? <Badge variant="success">enabled</Badge> : <Badge variant="default">paused</Badge>}
                            </div>
                            <p className="mt-2 break-all font-mono text-xs text-text-muted">{statusCopy(profile)}</p>
                            <p className="mt-1 line-clamp-2 break-all font-mono text-xs text-text-muted">{profile.url}</p>
                          </button>

                          <div className="flex flex-wrap gap-2">
                            <RetroBtn size="sm" variant="ghost" onClick={() => void handleRefresh(profile)} loading={busy} disabled={!profile.enabled}>
                              <RefreshCcw className="mr-1.5 inline-block h-3.5 w-3.5" />
                              Refresh
                            </RetroBtn>
                            <RetroBtn size="sm" variant="ghost" onClick={() => openEdit(profile)}>
                              <Edit3 className="mr-1.5 inline-block h-3.5 w-3.5" />
                              Edit
                            </RetroBtn>
                            <RetroBtn size="sm" variant="danger" onClick={() => setDeleteTarget(profile)}>
                              <Trash2 className="mr-1.5 inline-block h-3.5 w-3.5" />
                              Delete
                            </RetroBtn>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-4">
                          <MetaTile label="Proxy Count" value={profile.proxy_count} tone="text-warning" />
                          <MetaTile label="Interval" value={formatInterval(profile.update_interval)} detail={`${profile.update_interval}s`} />
                          <MetaTile label="Last Refresh" value={formatDate(profile.last_refresh_at)} />
                          <MetaTile label="Provider File" value={profile.provider_filename} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card
              title="Profile Inspector"
              icon={<ShieldAlert className="h-4 w-4" />}
              action={selected ? <Badge variant={statusTone(selected.status)}>{selected.status || "unknown"}</Badge> : undefined}
            >
              {!selected ? (
                <DataState
                  title="Select a profile"
                  message="Inspect subscription health, source URL, refresh timing, and generated provider file mapping."
                />
              ) : (
                <div className="space-y-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-heading text-xl uppercase tracking-wide text-text">{selected.name}</h2>
                      {selected.enabled ? <Badge variant="success">live</Badge> : <Badge variant="default">paused</Badge>}
                    </div>
                    <p className="mt-2 break-all font-mono text-xs text-text-muted">{selected.url}</p>
                  </div>

                  <DataState
                    tone={selected.status === "error" ? "danger" : selected.enabled ? "success" : "neutral"}
                    icon={selected.status === "error" ? <ServerCrash className="h-4 w-4" /> : selected.enabled ? <CheckCircle2 className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
                    title={selected.enabled ? selected.status || "Unknown status" : "Paused profile"}
                    message={statusCopy(selected)}
                    className="shadow-none"
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[12px] border-2 border-black bg-black/10 p-3">
                      <div className="flex items-center gap-2">
                        <FileStack className="h-4 w-4 text-info" />
                        <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Provider File</p>
                      </div>
                      <p className="mt-2 break-all font-heading text-sm uppercase tracking-wide text-text">{selected.provider_filename}</p>
                      <p className="mt-1 break-all font-mono text-xs text-text-muted">{selected.provider_path}</p>
                    </div>
                    <div className="rounded-[12px] border-2 border-black bg-black/10 p-3">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Imported Proxies</p>
                      <p className="mt-2 font-heading text-3xl text-warning">{selected.proxy_count}</p>
                      <p className="mt-1 font-mono text-xs text-text-muted">Count from last refresh run</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetaTile label="Last Refresh" value={formatDate(selected.last_refresh_at)} />
                    <MetaTile label="Last Success" value={formatDate(selected.last_success_at)} />
                    <MetaTile label="Updated" value={formatDate(selected.updated_at)} />
                    <MetaTile label="Refresh Interval" value={formatInterval(selected.update_interval)} detail={`${selected.update_interval}s`} />
                  </div>

                  <div className="flex items-start gap-3 rounded-[12px] border-2 border-black bg-black/10 p-3">
                    <Clock3 className="mt-0.5 h-4 w-4 text-info" />
                    <div>
                      <p className="font-heading text-xs uppercase tracking-wider text-text">Source and refresh contract</p>
                      <p className="mt-1 break-all font-mono text-xs text-text-muted">Source: {selected.url}</p>
                      <p className="mt-1 font-mono text-xs text-text-muted">
                        Created: {formatDate(selected.created_at)} / Updated: {formatDate(selected.updated_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <RetroBtn size="sm" onClick={() => void handleRefresh(selected)} loading={refreshingId === selected.id} disabled={!selected.enabled}>
                      <RefreshCcw className="mr-1.5 inline-block h-3.5 w-3.5" />
                      Refresh Now
                    </RetroBtn>
                    <RetroBtn size="sm" variant="ghost" onClick={() => openEdit(selected)}>
                      <Edit3 className="mr-1.5 inline-block h-3.5 w-3.5" />
                      Edit Profile
                    </RetroBtn>
                    <a
                      href={selected.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-[12px] border-2 border-black bg-transparent px-4 py-1.5 font-heading text-xs uppercase tracking-wider text-text transition hover:bg-black/10"
                    >
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      Open Source
                    </a>
                  </div>
                </div>
              )}
            </Card>

            <div className="rounded-[12px] border-2 border-warning bg-warning/10 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
                <div>
                  <p className="font-heading text-xs uppercase tracking-wider text-warning">Operator Baseline</p>
                  <p className="mt-1 font-mono text-xs text-text-muted">
                    Keep provider filenames stable after rollout. Downstream configs often point at generated files under proxy_providers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal open={editorOpen} title={editorMode === "create" ? "Create Profile" : "Edit Profile"} onClose={closeEditor}>
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="font-mono text-[11px] uppercase tracking-widest text-text-muted">Profile Name</span>
              <input
                value={form.name}
                onChange={(e) => {
                  const nextName = e.target.value;
                  updateForm("name", nextName);
                  if (editorMode === "create") {
                    updateForm("provider_filename", inferProviderFilename(nextName));
                  }
                }}
                placeholder="SG Residential Feed"
                className="w-full rounded-[12px] border-2 border-black bg-black/10 px-3 py-2 font-body text-sm text-text outline-none transition focus:border-primary"
              />
            </label>

            <label className="space-y-2">
              <span className="font-mono text-[11px] uppercase tracking-widest text-text-muted">Provider Filename</span>
              <input
                value={form.provider_filename}
                onChange={(e) => updateForm("provider_filename", e.target.value)}
                placeholder="sg-residential-feed.yaml"
                className="w-full rounded-[12px] border-2 border-black bg-black/10 px-3 py-2 font-mono text-sm text-text outline-none transition focus:border-primary"
              />
            </label>
          </div>

          <label className="space-y-2">
            <span className="font-mono text-[11px] uppercase tracking-widest text-text-muted">Subscription URL</span>
            <textarea
              value={form.url}
              onChange={(e) => updateForm("url", e.target.value)}
              rows={4}
              placeholder="https://provider.example/subscription"
              className="w-full rounded-[12px] border-2 border-black bg-black/10 px-3 py-2 font-mono text-sm text-text outline-none transition focus:border-primary"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
            <label className="space-y-2">
              <span className="font-mono text-[11px] uppercase tracking-widest text-text-muted">Interval Seconds</span>
              <input
                type="number"
                min={60}
                step={60}
                value={form.update_interval}
                onChange={(e) => updateForm("update_interval", Number(e.target.value) || 0)}
                className="w-full rounded-[12px] border-2 border-black bg-black/10 px-3 py-2 font-mono text-sm text-text outline-none transition focus:border-primary"
              />
            </label>

            <label className="flex items-center gap-3 rounded-[12px] border-2 border-black bg-black/10 px-3 py-2">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => updateForm("enabled", e.target.checked)}
                className="h-4 w-4 accent-[#0ca95b]"
              />
              <div>
                <p className="font-heading text-xs uppercase tracking-wider text-text">Enabled</p>
                <p className="font-mono text-xs text-text-muted">Profile stays active for operator use and refresh routines.</p>
              </div>
            </label>
          </div>

          <div className="rounded-[12px] border-2 border-info/40 bg-info/10 p-4">
            <div className="flex items-start gap-3">
              <Link2 className="mt-0.5 h-4 w-4 text-info" />
              <div>
                <p className="font-heading text-xs uppercase tracking-wider text-info">What save does</p>
                <p className="mt-1 font-mono text-xs text-text-muted">
                  Create writes metadata, generates provider YAML under proxy_providers, then attempts first refresh immediately.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <RetroBtn size="sm" variant="ghost" onClick={closeEditor}>
              Cancel
            </RetroBtn>
            <RetroBtn size="sm" onClick={() => void submitEditor()} loading={saving}>
              {editorMode === "create" ? "Create Profile" : "Save Changes"}
            </RetroBtn>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} title="Delete Profile" onClose={() => setDeleteTarget(null)}>
        <div className="space-y-4">
          <DataState
            tone="danger"
            icon={<Trash2 className="h-4 w-4" />}
            title="Destructive provider cleanup"
            message="This removes the subscription record and generated provider file. Keep it only if active Mihomo config no longer references this provider."
            className="shadow-none"
          />
          <div className="rounded-[12px] border-2 border-danger/40 bg-danger/10 px-3 py-3">
            <p className="font-heading text-sm uppercase tracking-wide text-text">{deleteTarget?.name}</p>
            <p className="mt-1 break-all font-mono text-xs text-text-muted">{deleteTarget?.provider_filename}</p>
            <p className="mt-1 break-all font-mono text-xs text-text-muted">{deleteTarget?.provider_path}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <RetroBtn size="sm" variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </RetroBtn>
            <RetroBtn size="sm" variant="danger" onClick={() => void confirmDelete()} loading={deleting}>
              Delete Profile
            </RetroBtn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

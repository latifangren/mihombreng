"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useModalAccessibility } from "@/hooks/use-modal-accessibility";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataState, FreshnessPill } from "@/components/ui/data-state";
import { RetroBtn } from "@/components/ui/retro-btn";
import { Skeleton } from "@/components/ui/skeleton";
import { mihomoApi } from "@/services/api";
import {
  CircleAlert,
  Download,
  Eye,
  FileCode2,
  FilePlus2,
  Files,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

type ProviderKind = "proxy" | "rule";

type ProviderRecord = {
  kind: ProviderKind;
  name: string;
  content?: string;
};

type ProviderSection = {
  kind: ProviderKind;
  label: string;
  badge: "warning" | "success";
  emptyText: string;
  createLabel: string;
};

const SECTIONS: ProviderSection[] = [
  {
    kind: "proxy",
    label: "Proxy Providers",
    badge: "warning",
    emptyText: "No proxy providers yet. Upload or create one to feed proxy groups.",
    createLabel: "Create Proxy Provider",
  },
  {
    kind: "rule",
    label: "Rule Providers",
    badge: "success",
    emptyText: "No rule providers yet. Upload or create one for routing rule bundles.",
    createLabel: "Create Rule Provider",
  },
];

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
      <div ref={containerRef} className="w-full max-w-lg rounded-[16px] border-2 border-black bg-surface p-5 shadow-[8px_8px_0_#000] outline-none">
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

function inferProviderMeta(content: string) {
  const line = (regex: RegExp) => content.match(regex)?.[1]?.trim() || "—";
  const trimmedLines = content
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const firstUpdated = line(/updated?\s*[:=]\s*(.+)$/im);
  const proxyLikeCount = trimmedLines.filter((item) => /^-\s*name:|^name:/i.test(item)).length;

  return {
    type: line(/^type:\s*(.+)$/m),
    path: line(/^path:\s*(.+)$/m),
    url: line(/^url:\s*(.+)$/m),
    interval: line(/^interval:\s*(.+)$/m),
    behavior: line(/^behavior:\s*(.+)$/m),
    healthCheck: line(/^health-check:\s*(.+)$/m),
    updated: firstUpdated,
    lineCount: trimmedLines.length,
    proxyLikeCount,
    charCount: content.length,
  };
}

function providerPath(kind: ProviderKind, name: string) {
  return kind === "proxy" ? `proxy-providers/${name}` : `rule-providers/${name}`;
}

function ProviderSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {["proxy", "rule"].map((key) => (
        <Card key={key}>
          <Skeleton width="160px" height="14px" />
          <div className="mt-4 space-y-3">
            {["a", "b", "c"].map((row) => (
              <Skeleton key={`${key}-${row}`} height="86px" />
            ))}
          </div>
        </Card>
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

export default function ProvidersPage() {
  const [proxyProviders, setProxyProviders] = useState<string[]>([]);
  const [ruleProviders, setRuleProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ProviderRecord | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [createKind, setCreateKind] = useState<ProviderKind | null>(null);
  const [createName, setCreateName] = useState("");
  const [renameTarget, setRenameTarget] = useState<ProviderRecord | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ProviderRecord | null>(null);
  const [uploadKind, setUploadKind] = useState<ProviderKind | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);

  const loadProviders = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "init") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    try {
      const [proxy, rule] = await Promise.all([
        mihomoApi.getProxyProviders(),
        mihomoApi.getRuleProviders(),
      ]);
      setProxyProviders(proxy);
      setRuleProviders(rule);
      setLastLoadedAt(new Date());
      setLoadError(null);

      setSelected((prev) => {
        if (!prev) return null;
        const source = prev.kind === "proxy" ? proxy : rule;
        return source.includes(prev.name) ? { ...prev, content: prev.content } : null;
      });
      if (mode === "refresh") toast.success("Providers refreshed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load providers";
      setLoadError(message);
      toast.error(message);
    } finally {
      if (mode === "init") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  const filteredProxy = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return proxyProviders.filter((name) => !needle || name.toLowerCase().includes(needle));
  }, [proxyProviders, query]);

  const filteredRule = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ruleProviders.filter((name) => !needle || name.toLowerCase().includes(needle));
  }, [ruleProviders, query]);

  const loadContent = useCallback(async (kind: ProviderKind, name: string) => {
    setPreviewLoading(true);
    try {
      const content =
        kind === "proxy"
          ? await mihomoApi.getProxyProviderContent(name)
          : await mihomoApi.getRuleProviderContent(name);
      setSelected({ kind, name, content });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load provider content");
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  const handleCreate = async () => {
    if (!createKind || !createName.trim()) return;
    setBusyAction(`create-${createKind}`);
    try {
      if (createKind === "proxy") {
        await mihomoApi.createProxyProvider(createName.trim());
      } else {
        await mihomoApi.createRuleProvider(createName.trim());
      }
      toast.success("Provider created");
      setCreateKind(null);
      setCreateName("");
      await loadProviders("refresh");
      await loadContent(createKind, createName.trim());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusyAction(null);
    }
  };

  const handleUploadFile = async (file: File) => {
    if (!uploadKind) return;
    setBusyAction(`upload-${uploadKind}`);
    try {
      if (uploadKind === "proxy") {
        await mihomoApi.uploadProxyProvider(file);
      } else {
        await mihomoApi.uploadRuleProvider(file);
      }
      toast.success("Provider uploaded");
      setUploadKind(null);
      if (uploadRef.current) uploadRef.current.value = "";
      await loadProviders("refresh");
      await loadContent(uploadKind, file.name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusyAction(null);
    }
  };

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    setBusyAction(`rename-${renameTarget.kind}`);
    try {
      if (renameTarget.kind === "proxy") {
        await mihomoApi.renameProxyProvider(renameTarget.name, renameValue.trim());
      } else {
        await mihomoApi.renameRuleProvider(renameTarget.name, renameValue.trim());
      }
      toast.success("Provider renamed");
      const renamedKind = renameTarget.kind;
      const newName = renameValue.trim();
      const wasSelected = selected?.kind === renameTarget.kind && selected.name === renameTarget.name;
      setRenameTarget(null);
      await loadProviders("refresh");
      if (wasSelected) await loadContent(renamedKind, newName);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rename failed");
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusyAction(`delete-${deleteTarget.kind}`);
    try {
      if (deleteTarget.kind === "proxy") {
        await mihomoApi.deleteProxyProvider(deleteTarget.name);
      } else {
        await mihomoApi.deleteRuleProvider(deleteTarget.name);
      }
      toast.success("Provider deleted");
      if (selected?.kind === deleteTarget.kind && selected.name === deleteTarget.name) {
        setSelected(null);
      }
      setDeleteTarget(null);
      await loadProviders("refresh");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownload = async (kind: ProviderKind, name: string) => {
    setBusyAction(`download-${kind}-${name}`);
    try {
      if (kind === "proxy") {
        await mihomoApi.downloadProxyProvider(name);
      } else {
        await mihomoApi.downloadRuleProvider(name);
      }
      toast.success("Provider downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusyAction(null);
    }
  };

  const selectedMeta = useMemo(() => {
    if (!selected?.content) return null;
    return inferProviderMeta(selected.content);
  }, [selected]);

  const providerCount = proxyProviders.length + ruleProviders.length;
  const visibleCount = filteredProxy.length + filteredRule.length;
  const posture = loadError ? "Index stale" : providerCount === 0 ? "No files" : selected ? "Inspecting file" : "Files ready";
  const postureTone = loadError ? "text-danger" : providerCount === 0 ? "text-text" : selected ? "text-info" : "text-primary";

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[16px] border-2 border-black bg-surface p-5 shadow-[8px_8px_0_#000]">
        <div className="absolute right-[-70px] top-[-70px] h-44 w-44 rounded-full border-2 border-black bg-warning/10" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl uppercase tracking-wide text-text">Providers</h1>
              <FreshnessPill loading={loading || refreshing} error={loadError} lastUpdatedAt={lastLoadedAt} stale={Boolean(loadError && providerCount > 0)} />
            </div>
            <p className="mt-2 font-mono text-xs uppercase tracking-wider text-text-muted">
              Proxy and rule provider files for Mihomo routing operations
            </p>
            <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Provider posture</p>
                <p className={`font-heading text-4xl uppercase tracking-wide ${postureTone}`}>{posture}</p>
              </div>
              <div className="pb-1 font-mono text-xs text-text-muted">
                {proxyProviders.length} proxy / {ruleProviders.length} rule / {visibleCount} visible
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <RetroBtn variant="ghost" size="sm" onClick={() => void loadProviders("refresh")} loading={refreshing}>
              <RefreshCcw className="mr-1.5 inline-block h-3.5 w-3.5" />
              Refresh Index
            </RetroBtn>
            <RetroBtn size="sm" onClick={() => { setCreateKind("proxy"); setCreateName(""); }}>
              <Plus className="mr-1.5 inline-block h-3.5 w-3.5" />
              New Proxy
            </RetroBtn>
            <RetroBtn size="sm" variant="ghost" onClick={() => setUploadKind("proxy")}>
              <Upload className="mr-1.5 inline-block h-3.5 w-3.5" />
              Upload
            </RetroBtn>
          </div>
        </div>
      </div>

      {loadError && (
        <DataState
          tone="danger"
          icon={<CircleAlert className="h-4 w-4" />}
          title={providerCount > 0 ? "Provider index stale" : "Providers unavailable"}
          message={providerCount > 0 ? `Keeping the last provider index visible. Backend said: ${loadError}` : loadError}
          action={<RetroBtn size="sm" variant="ghost" onClick={() => void loadProviders("refresh")} loading={refreshing}>Retry</RetroBtn>}
        />
      )}

      {loading ? (
        <ProviderSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card title="Total Files" className="p-4">
              <div className="font-heading text-3xl text-text">{providerCount}</div>
            </Card>
            <Card title="Proxy Providers" className="p-4">
              <div className="font-heading text-3xl text-warning">{proxyProviders.length}</div>
            </Card>
            <Card title="Rule Providers" className="p-4">
              <div className="font-heading text-3xl text-primary">{ruleProviders.length}</div>
            </Card>
            <Card title="Visible" className="p-4">
              <div className="font-heading text-3xl text-info">{visibleCount}</div>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
            <div className="space-y-6">
              <Card title="Provider File Index" icon={<Files className="h-4 w-4" />} action={<Badge variant="default">{visibleCount} visible</Badge>}>
                <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
                  <label className="flex items-center gap-2 rounded-[12px] border-2 border-black bg-black/10 px-3 py-2">
                    <Search className="h-4 w-4 text-text-muted" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search provider filename..."
                      className="w-full bg-transparent font-mono text-sm text-text outline-none placeholder:text-text-muted"
                    />
                  </label>
                  <RetroBtn size="sm" variant="ghost" onClick={() => { setCreateKind("proxy"); setCreateName(""); }}>
                    <FilePlus2 className="mr-1.5 inline-block h-3.5 w-3.5" />
                    New Proxy
                  </RetroBtn>
                  <RetroBtn size="sm" variant="ghost" onClick={() => { setCreateKind("rule"); setCreateName(""); }}>
                    <FilePlus2 className="mr-1.5 inline-block h-3.5 w-3.5" />
                    New Rule
                  </RetroBtn>
                  <RetroBtn size="sm" variant="ghost" onClick={() => setUploadKind("rule")}>
                    <Upload className="mr-1.5 inline-block h-3.5 w-3.5" />
                    Upload Rule
                  </RetroBtn>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  {SECTIONS.map((section) => {
                    const list = section.kind === "proxy" ? filteredProxy : filteredRule;
                    const sourceCount = section.kind === "proxy" ? proxyProviders.length : ruleProviders.length;
                    return (
                      <div key={section.kind} className="rounded-[14px] border-2 border-black bg-black/5 p-4">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-heading text-sm uppercase tracking-wide text-text">{section.label}</h3>
                            <Badge variant={section.badge}>{section.kind}</Badge>
                          </div>
                          <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted">{list.length}/{sourceCount}</span>
                        </div>

                        {list.length === 0 ? (
                          <DataState
                            tone={sourceCount === 0 ? "neutral" : "warning"}
                            icon={<FileCode2 className="h-4 w-4" />}
                            title={sourceCount === 0 ? "No provider files" : "No search matches"}
                            message={sourceCount === 0 ? section.emptyText : "Clear the search to see this provider section again."}
                            action={sourceCount === 0 ? <RetroBtn size="sm" variant="ghost" onClick={() => { setCreateKind(section.kind); setCreateName(""); }}>{section.createLabel}</RetroBtn> : undefined}
                            className="shadow-none"
                          />
                        ) : (
                          <div className="space-y-3">
                            {list.map((name) => {
                              const active = selected?.kind === section.kind && selected.name === name;
                              return (
                                <div
                                  key={`${section.kind}-${name}`}
                                  className={`rounded-[12px] border-2 p-4 transition-all ${active ? "border-primary bg-primary/10 shadow-[6px_6px_0_#000]" : "border-black bg-black/10 hover:bg-black/20"}`}
                                >
                                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <button type="button" onClick={() => void loadContent(section.kind, name)} className="min-w-0 text-left">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="break-all font-heading text-sm uppercase tracking-wide text-text">{name}</p>
                                        <Badge variant={section.badge}>{section.kind}</Badge>
                                        {active && <Badge variant="info">selected</Badge>}
                                      </div>
                                      <p className="mt-2 break-all font-mono text-xs text-text-muted">{providerPath(section.kind, name)}</p>
                                      <p className="mt-1 font-mono text-xs text-text-muted">Preview before rename, download, or delete.</p>
                                    </button>
                                    <div className="flex flex-wrap gap-2">
                                      <RetroBtn size="sm" variant="ghost" onClick={() => void loadContent(section.kind, name)} loading={previewLoading && active}>
                                        <Eye className="mr-1.5 inline-block h-3.5 w-3.5" />
                                        Preview
                                      </RetroBtn>
                                      <RetroBtn size="sm" variant="ghost" onClick={() => { setRenameTarget({ kind: section.kind, name }); setRenameValue(name); }}>
                                        <Pencil className="mr-1.5 inline-block h-3.5 w-3.5" />
                                        Rename
                                      </RetroBtn>
                                      <RetroBtn size="sm" variant="ghost" onClick={() => void handleDownload(section.kind, name)} loading={busyAction === `download-${section.kind}-${name}`}>
                                        <Download className="mr-1.5 inline-block h-3.5 w-3.5" />
                                        Download
                                      </RetroBtn>
                                      <RetroBtn size="sm" variant="danger" onClick={() => setDeleteTarget({ kind: section.kind, name })}>
                                        <Trash2 className="mr-1.5 inline-block h-3.5 w-3.5" />
                                        Delete
                                      </RetroBtn>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>

            <div className="space-y-6">
              <Card
                title="Provider Inspector"
                icon={<FileCode2 className="h-4 w-4" />}
                action={selected ? <Badge variant={selected.kind === "proxy" ? "warning" : "success"}>{selected.kind}</Badge> : undefined}
              >
                {!selected ? (
                  <DataState
                    title="Select provider file"
                    message="Preview content and inferred metadata before rename, download, or delete."
                  />
                ) : previewLoading ? (
                  <div className="space-y-3">
                    <Skeleton width="220px" height="18px" />
                    <Skeleton height="80px" />
                    <Skeleton height="160px" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-all font-heading text-base uppercase tracking-wide text-text">{selected.name}</h3>
                        <Badge variant={selected.kind === "proxy" ? "warning" : "success"}>{selected.kind}</Badge>
                      </div>
                      <p className="mt-1 break-all font-mono text-xs text-text-muted">{providerPath(selected.kind, selected.name)}</p>
                    </div>

                    {selectedMeta && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <MetaTile label="type" value={selectedMeta.type} />
                        <MetaTile label="interval" value={selectedMeta.interval} />
                        <MetaTile label="behavior" value={selectedMeta.behavior} />
                        <MetaTile label="yaml lines" value={selectedMeta.lineCount} detail={`${selectedMeta.charCount.toLocaleString()} chars`} />
                        <MetaTile label="path" value={selectedMeta.path} />
                        <MetaTile label="items hinted" value={selectedMeta.proxyLikeCount} detail="name fields found" />
                      </div>
                    )}

                    {selectedMeta?.url && selectedMeta.url !== "—" && (
                      <div className="rounded-[12px] border-2 border-black bg-black/10 p-3">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Source URL</p>
                        <p className="mt-1 break-all font-mono text-xs text-text">{selectedMeta.url}</p>
                      </div>
                    )}

                    <div className="rounded-[12px] border-2 border-black bg-background p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="font-heading text-xs uppercase tracking-wider text-text">Content Preview</p>
                        <Badge variant="default">read only</Badge>
                      </div>
                      <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-[8px] bg-black/20 p-3 font-mono text-xs leading-relaxed text-text-muted">
                        {selected.content || "No content loaded."}
                      </pre>
                    </div>

                    <DataState
                      tone="warning"
                      icon={<ShieldAlert className="h-4 w-4" />}
                      title="Operational caution"
                      message="Provider filenames are often referenced from active Mihomo config. Rename or delete only after checking downstream config references."
                      className="shadow-none"
                    />
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      )}

      <Modal open={!!createKind} title={createKind === "proxy" ? "Create Proxy Provider" : "Create Rule Provider"} onClose={() => setCreateKind(null)}>
        <div className="space-y-4">
          <DataState
            tone="neutral"
            icon={<FilePlus2 className="h-4 w-4" />}
            title="Create empty provider file"
            message="This creates a YAML provider file. Fill content in the config editor or upload a ready file if you have one."
            className="shadow-none"
          />
          <input
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleCreate();
            }}
            placeholder="provider.yaml"
            className="w-full rounded-[12px] border-2 border-black bg-black/10 px-3 py-2 font-mono text-sm text-text outline-none transition focus:border-primary"
          />
          <div className="flex justify-end gap-2">
            <RetroBtn size="sm" variant="ghost" onClick={() => setCreateKind(null)}>Cancel</RetroBtn>
            <RetroBtn size="sm" onClick={() => void handleCreate()} loading={busyAction === `create-${createKind}`}>Create</RetroBtn>
          </div>
        </div>
      </Modal>

      <Modal open={!!renameTarget} title="Rename Provider" onClose={() => setRenameTarget(null)}>
        <div className="space-y-4">
          <DataState
            tone="warning"
            icon={<Pencil className="h-4 w-4" />}
            title="Rename referenced file"
            message="Renaming changes the filename Mihomo configs may point at. Confirm configs are updated before applying."
            className="shadow-none"
          />
          <input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleRename();
            }}
            className="w-full rounded-[12px] border-2 border-black bg-black/10 px-3 py-2 font-mono text-sm text-text outline-none transition focus:border-primary"
          />
          <p className="break-all font-mono text-xs text-text-muted">Current: {renameTarget ? providerPath(renameTarget.kind, renameTarget.name) : "—"}</p>
          <div className="flex justify-end gap-2">
            <RetroBtn size="sm" variant="ghost" onClick={() => setRenameTarget(null)}>Cancel</RetroBtn>
            <RetroBtn size="sm" onClick={() => void handleRename()} loading={busyAction === `rename-${renameTarget?.kind}`}>Rename</RetroBtn>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} title="Delete Provider" onClose={() => setDeleteTarget(null)}>
        <div className="space-y-4">
          <DataState
            tone="danger"
            icon={<Trash2 className="h-4 w-4" />}
            title="Destructive provider removal"
            message="This deletes the provider file from disk. Active configs may fail if they still reference it. Download a backup first if unsure."
            className="shadow-none"
          />
          <div className="rounded-[12px] border-2 border-danger/40 bg-danger/10 px-3 py-3">
            <p className="break-all font-heading text-sm uppercase tracking-wide text-text">{deleteTarget?.name}</p>
            <p className="mt-1 break-all font-mono text-xs text-text-muted">{deleteTarget ? providerPath(deleteTarget.kind, deleteTarget.name) : "—"}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <RetroBtn size="sm" variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</RetroBtn>
            {deleteTarget && (
              <RetroBtn size="sm" variant="ghost" onClick={() => void handleDownload(deleteTarget.kind, deleteTarget.name)}>
                <Download className="mr-1.5 inline-block h-3.5 w-3.5" />
                Backup First
              </RetroBtn>
            )}
            <RetroBtn size="sm" variant="danger" onClick={() => void handleDelete()} loading={busyAction === `delete-${deleteTarget?.kind}`}>
              Delete Provider
            </RetroBtn>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!uploadKind}
        title={uploadKind === "proxy" ? "Upload Proxy Provider" : "Upload Rule Provider"}
        onClose={() => { setUploadKind(null); if (uploadRef.current) uploadRef.current.value = ""; }}
      >
        <div className="space-y-4">
          <DataState
            tone="neutral"
            icon={<Upload className="h-4 w-4" />}
            title="Upload YAML provider"
            message="Accepts provider files from remote workflow or local backups. Existing filenames may be overwritten by backend behavior."
            className="shadow-none"
          />
          <input
            ref={uploadRef}
            type="file"
            accept=".yaml,.yml"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void handleUploadFile(file);
            }}
            className="block w-full text-sm text-text-muted file:mr-3 file:rounded-[8px] file:border-2 file:border-border file:bg-surface-hover file:px-4 file:py-1.5 file:font-heading file:text-xs file:uppercase file:text-text hover:file:bg-primary/20"
          />
          {busyAction === `upload-${uploadKind}` && (
            <p className="font-mono text-xs text-warning">Uploading provider file...</p>
          )}
        </div>
      </Modal>
    </div>
  );
}

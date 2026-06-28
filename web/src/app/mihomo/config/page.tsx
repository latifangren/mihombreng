"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useModalAccessibility } from "@/hooks/use-modal-accessibility";
import type { ReactNode } from "react";
import Editor, { DiffEditor, type OnMount } from "@monaco-editor/react";
import { RetroBtn } from "@/components/ui/retro-btn";
import { Badge } from "@/components/ui/badge";
import { DataState, FreshnessPill } from "@/components/ui/data-state";
import { Skeleton } from "@/components/ui/skeleton";
import { mihomoApi } from "@/services/api";
import { cn } from "@/utils/cn";
import toast from "react-hot-toast";
import type { editor } from "monaco-editor";
import type { ConfigValidationResult } from "@/types";
import {
  CircleAlert,
  CircleCheckBig,
  FileCode2,
  FilePlus2,
  FileWarning,
  FolderTree,
  Power,
  RefreshCcw,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

type FileTab = {
  name: string;
  dirty: boolean;
  content: string;
  savedContent: string;
  type: "config" | "provider" | "rules";
};

function formatFileType(type?: FileTab["type"]) {
  if (type === "config") return "Mihomo config";
  if (type === "provider") return "Proxy provider";
  if (type === "rules") return "Rule provider";
  return "No file selected";
}

function formatLineCount(content?: string) {
  if (!content) return 0;
  return content.split("\n").length;
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

function LoadingConfigEditor() {
  return (
    <div className="space-y-6">
      <div className="rounded-[16px] border-2 border-black bg-surface p-5 shadow-[8px_8px_0_#000]">
        <Skeleton width="220px" height="28px" />
        <Skeleton width="420px" height="12px" className="mt-3 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <div className="space-y-3">
          <Skeleton height="160px" />
          <Skeleton height="120px" />
        </div>
        <Skeleton height="520px" />
      </div>
    </div>
  );
}

function MetaTile({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-black/70 bg-black/15 px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{label}</p>
      <div className="mt-1 break-words font-heading text-lg text-text">{value}</div>
      {detail && <div className="mt-1 break-words font-mono text-[11px] text-text-muted">{detail}</div>}
    </div>
  );
}

export default function ConfigEditorPage() {
  const [configs, setConfigs] = useState<string[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [rules, setRules] = useState<string[]>([]);
  const [activeConfig, setActiveConfig] = useState<string>("");
  const [tabs, setTabs] = useState<FileTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingFiles, setRefreshingFiles] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [validating, setValidating] = useState<string | null>(null);
  const [validation, setValidation] = useState<Record<string, ConfigValidationResult>>({});
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const newFileInputRef = useRef<HTMLInputElement | null>(null);

  const [monacoInstance, setMonacoInstance] = useState<Parameters<OnMount>[1] | null>(null);

  const activeFile = tabs.find((t) => t.name === activeTab);
  const activeValidation = activeFile ? validation[activeFile.name] : undefined;
  const dirtyTabs = useMemo(() => tabs.filter((t) => t.dirty), [tabs]);
  const dirtyCount = dirtyTabs.length;
  const configValidationCount = Object.values(validation).filter((item) => item.valid).length;
  const invalidCount = Object.values(validation).filter((item) => !item.valid).length;

  useEffect(() => {
    if (!activeFile || activeFile.type !== "config" || !activeFile.dirty) return;

    const timeoutId = setTimeout(async () => {
      setValidating(activeFile.name);
      try {
        const result = await mihomoApi.validateConfig(activeFile.name, activeFile.content);
        setValidation((prev) => ({ ...prev, [activeFile.name]: result }));
      } catch (err) {
        console.error("Debounced validation error:", err);
      } finally {
        setValidating(null);
      }
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [activeFile]);

  useEffect(() => {
    if (!editorRef.current || !activeFile || !monacoInstance) return;
    const model = editorRef.current.getModel();
    if (!model) return;

    if (!activeValidation || activeValidation.valid) {
      monacoInstance.editor.setModelMarkers(model, "owner-yaml", []);
      return;
    }

    const markers = activeValidation.issues
      .filter((issue) => issue.level === "error" && issue.line !== undefined && issue.line > 0)
      .map((issue) => {
        const line = issue.line || 1;
        const col = issue.column || 1;
        return {
          startLineNumber: line,
          startColumn: col,
          endLineNumber: line,
          endColumn: col + 4,
          message: issue.message,
          severity: 8, // monaco.MarkerSeverity.Error represents 8
        };
      });

    monacoInstance.editor.setModelMarkers(model, "owner-yaml", markers);
  }, [activeValidation, activeFile, monacoInstance]);

  const loadFiles = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "init") setLoading(true);
    if (mode === "refresh") setRefreshingFiles(true);
    try {
      const [cfgList, provList, ruleList, active] = await Promise.all([
        mihomoApi.getConfigs(),
        mihomoApi.getProxyProviders(),
        mihomoApi.getRuleProviders(),
        mihomoApi.getActiveConfig(),
      ]);
      setConfigs(cfgList);
      setProviders(provList.data);
      setRules(ruleList.data);
      setActiveConfig(active);
      setLastLoadedAt(new Date());
      setLoadError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load files";
      setLoadError(message);
      toast.error(message);
    } finally {
      if (mode === "init") setLoading(false);
      if (mode === "refresh") setRefreshingFiles(false);
    }
  }, []);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    if (dirtyTabs.length === 0) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirtyTabs.length]);

  const openFile = async (name: string, type: FileTab["type"]) => {
    if (tabs.find((t) => t.name === name)) {
      setActiveTab(name);
      return;
    }
    try {
      const fetchers: Record<string, (n: string) => Promise<string>> = {
        config: mihomoApi.getConfigContent.bind(mihomoApi),
        provider: mihomoApi.getProxyProviderContent.bind(mihomoApi),
        rules: mihomoApi.getRuleProviderContent.bind(mihomoApi),
      };
      const content = await (fetchers[type] || mihomoApi.getConfigContent)(name);
      setTabs((prev) => [
        ...prev,
        { name, content, savedContent: content, dirty: false, type },
      ]);
      setActiveTab(name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load file content");
    }
  };

  const closeTab = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tab = tabs.find((t) => t.name === name);
    if (tab?.dirty) {
      if (!confirm(`"${name}" has unsaved changes. Close anyway?`)) return;
    }
    setTabs((prev) => prev.filter((t) => t.name !== name));
    if (activeTab === name) {
      const idx = tabs.findIndex((t) => t.name === name);
      const remaining = tabs.filter((t) => t.name !== name);
      setActiveTab(remaining[idx]?.name ?? remaining[idx - 1]?.name ?? null);
    }
  };

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (!activeTab) return;
      const nextValue = value ?? "";
      setTabs((prev) =>
        prev.map((t) =>
          t.name === activeTab
            ? { ...t, content: nextValue, dirty: nextValue !== t.savedContent }
            : t
        )
      );
    },
    [activeTab]
  );

  const handleValidate = useCallback(async (): Promise<ConfigValidationResult | null> => {
    if (!activeFile || activeFile.type !== "config") return null;
    setValidating(activeFile.name);
    try {
      const result = await mihomoApi.validateConfig(activeFile.name, activeFile.content);
      setValidation((prev) => ({ ...prev, [activeFile.name]: result }));
      if (result.valid) {
        toast.success("Config validation passed");
      } else {
        toast.error(result.summary || "Config invalid");
      }
      return result;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Validation failed");
      return null;
    } finally {
      setValidating(null);
    }
  }, [activeFile]);

  const handleJumpToError = (line: number | undefined, column: number | undefined) => {
    if (!line) return;
    const l = line;
    const c = column || 1;
    if (showDiff && diffEditorRef.current) {
      const modified = diffEditorRef.current.getModifiedEditor();
      modified.revealLineInCenter(l);
      modified.setPosition({ lineNumber: l, column: c });
      modified.focus();
    } else if (editorRef.current) {
      editorRef.current.revealLineInCenter(l);
      editorRef.current.setPosition({ lineNumber: l, column: c });
      editorRef.current.focus();
    }
  };

  const saveTab = useCallback(async (tab: FileTab) => {
    if (tab.type === "config") {
      let latestValidation: ConfigValidationResult | null = validation[tab.name] || null;
      if (!latestValidation || tab.dirty) {
        setValidating(tab.name);
        try {
          latestValidation = await mihomoApi.validateConfig(tab.name, tab.content);
          setValidation((prev) => ({ ...prev, [tab.name]: latestValidation! }));
        } catch (err) {
          toast.error(err instanceof Error ? err.message : `Validation failed: ${tab.name}`);
          return false;
        } finally {
          setValidating(null);
        }
      }
      if (latestValidation && !latestValidation.valid) {
        setActiveTab(tab.name);
        toast.error(`Fix validation errors before saving ${tab.name}`);
        return false;
      }
    }

    setSaving(tab.name);
    try {
      if (tab.type === "config") {
        await mihomoApi.saveConfig(tab.name, tab.content);
      } else if (tab.type === "provider") {
        await mihomoApi.saveProxyProvider(tab.name, tab.content);
      } else {
        await mihomoApi.saveRuleProvider(tab.name, tab.content);
      }
      setTabs((prev) =>
        prev.map((t) =>
          t.name === tab.name
            ? { ...t, savedContent: t.content, dirty: false }
            : t
        )
      );
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Save failed: ${tab.name}`);
      return false;
    } finally {
      setSaving(null);
    }
  }, [validation]);

  const handleSave = useCallback(async () => {
    if (!activeFile) return;
    const ok = await saveTab(activeFile);
    if (ok) toast.success("Saved");
  }, [activeFile, saveTab]);

  const handleSaveAll = useCallback(async () => {
    if (dirtyTabs.length === 0) return;
    let saved = 0;
    for (const tab of dirtyTabs) {
      const ok = await saveTab(tab);
      if (!ok) return;
      saved += 1;
    }
    toast.success(`Saved ${saved} file${saved > 1 ? "s" : ""}`);
  }, [dirtyTabs, saveTab]);

  const handleRevertCurrent = useCallback(() => {
    if (!activeFile || !activeFile.dirty) return;
    if (!confirm(`Discard local changes in ${activeFile.name}? This only reverts the editor buffer.`)) return;
    setTabs((prev) =>
      prev.map((t) =>
        t.name === activeFile.name
          ? { ...t, content: t.savedContent, dirty: false }
          : t
      )
    );
    setValidation((prev) => {
      const next = { ...prev };
      delete next[activeFile.name];
      return next;
    });
    toast.success("Changes reverted");
  }, [activeFile]);

  const handleEditorChangeRef = useRef(handleEditorChange);
  const handleSaveRef = useRef(handleSave);
  const handleSaveAllRef = useRef(handleSaveAll);
  const handleRevertRef = useRef(handleRevertCurrent);
  const handleValidateRef = useRef(handleValidate);

  useEffect(() => {
    handleEditorChangeRef.current = handleEditorChange;
    handleSaveRef.current = handleSave;
    handleSaveAllRef.current = handleSaveAll;
    handleRevertRef.current = handleRevertCurrent;
    handleValidateRef.current = handleValidate;
  }, [handleEditorChange, handleSave, handleSaveAll, handleRevertCurrent, handleValidate]);

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      
      // Ctrl+S / Ctrl+Shift+S / Ctrl+Alt+Z / Ctrl+Alt+R
      if (event.ctrlKey || event.metaKey) {
        if (key === "s") {
          event.preventDefault();
          if (event.shiftKey) {
            void handleSaveAllRef.current();
          } else {
            void handleSaveRef.current();
          }
        } else if (event.altKey && (key === "z" || key === "r")) {
          event.preventDefault();
          handleRevertRef.current();
        }
      }
      
      // Alt+D / Alt+V
      if (event.altKey) {
        if (key === "d") {
          event.preventDefault();
          setShowDiff((prev) => !prev);
        } else if (key === "v") {
          event.preventDefault();
          void handleValidateRef.current();
        }
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, []);

  const handleSetActive = async (name: string) => {
    const target = tabs.find((tab) => tab.name === name);
    if (target?.dirty) {
      toast.error("Save local edits before activating this config");
      return;
    }
    try {
      await mihomoApi.setActiveConfig(name);
      setActiveConfig(name);
      toast.success(`Active config: ${name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set active config");
    }
  };

  const handleCreateFile = async () => {
    const name = newFileName.trim();
    if (!name) return;
    try {
      await mihomoApi.createConfig(name);
      setConfigs((prev) => [...prev, name]);
      setShowNewFile(false);
      setNewFileName("");
      toast.success("Config created");
      await openFile(name, "config");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create config");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await mihomoApi.deleteConfig(deleteTarget);
      setConfigs((prev) => prev.filter((c) => c !== deleteTarget));
      setTabs((prev) => prev.filter((t) => t.name !== deleteTarget));
      if (activeTab === deleteTarget) setActiveTab(null);
      toast.success("Config deleted");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    setMonacoInstance(monaco);

    // Add Save command (Ctrl+S)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      void handleSaveRef.current();
    });
    
    // Add Save All command (Ctrl+Shift+S)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, () => {
      void handleSaveAllRef.current();
    });

    // Add Revert command (Ctrl+Alt+Z / Ctrl+Alt+R)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyZ, () => {
      handleRevertRef.current();
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyR, () => {
      handleRevertRef.current();
    });

    // Add Toggle Diff command (Alt+D)
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyD, () => {
      setShowDiff((prev) => !prev);
    });

    // Add Validate command (Alt+V)
    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyV, () => {
      void handleValidateRef.current();
    });
  };

  const handleDiffMount = (editor: editor.IStandaloneDiffEditor, monaco: Parameters<OnMount>[1]) => {
    diffEditorRef.current = editor;

    const modifiedEditor = editor.getModifiedEditor();
    modifiedEditor.onDidChangeModelContent(() => {
      const val = modifiedEditor.getValue();
      handleEditorChangeRef.current(val);
    });

    // Register shortcuts on modified side
    modifiedEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      void handleSaveRef.current();
    });
    modifiedEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, () => {
      void handleSaveAllRef.current();
    });
    modifiedEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyZ, () => {
      handleRevertRef.current();
    });
    modifiedEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyR, () => {
      handleRevertRef.current();
    });
    modifiedEditor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyD, () => {
      setShowDiff((prev) => !prev);
    });
    modifiedEditor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyV, () => {
      void handleValidateRef.current();
    });
  };

  const showNewFileInput = () => {
    setShowNewFile(true);
    setTimeout(() => newFileInputRef.current?.focus(), 10);
  };

  const configHealth = invalidCount > 0 ? "Validation blocked" : dirtyCount > 0 ? "Draft changes" : tabs.length > 0 ? "Ready to edit" : "Choose a file";
  const configHealthTone = invalidCount > 0 ? "text-danger" : dirtyCount > 0 ? "text-warning" : "text-primary";

  if (loading) {
    return <LoadingConfigEditor />;
  }

  const renderFileButton = (name: string, type: FileTab["type"]) => {
    const isOpen = tabs.some((tab) => tab.name === name);
    const isDirty = tabs.some((tab) => tab.name === name && tab.dirty);
    return (
      <button
        type="button"
        key={name}
        onClick={() => void openFile(name, type)}
        className={cn(
          "flex w-full items-center gap-2 truncate rounded-[6px] px-2 py-1.5 text-left font-mono text-xs transition-colors",
          activeTab === name
            ? "bg-surface text-text"
            : "text-text-muted hover:bg-surface/50 hover:text-text"
        )}
      >
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", isDirty ? "bg-warning" : isOpen ? "bg-info" : "bg-text-muted/50")} />
        <span className="truncate">{name}</span>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[16px] border-2 border-black bg-surface p-5 shadow-[8px_8px_0_#000]">
        <div className="absolute right-[-70px] top-[-70px] h-44 w-44 rounded-full border-2 border-black bg-info/10" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl uppercase tracking-wide text-text">Config Editor</h1>
              <FreshnessPill loading={refreshingFiles} error={loadError} lastUpdatedAt={lastLoadedAt} stale={Boolean(loadError && configs.length > 0)} />
            </div>
            <p className="mt-2 font-mono text-xs uppercase tracking-wider text-text-muted">
              Edit Mihomo YAML, provider files, and rule providers with validation gates
            </p>
            <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Editor posture</p>
                <p className={`font-heading text-4xl uppercase tracking-wide ${configHealthTone}`}>{configHealth}</p>
              </div>
              <div className="pb-1 font-mono text-xs text-text-muted">
                Active: {activeConfig || "unknown"} / {dirtyCount} unsaved / {invalidCount} invalid
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <RetroBtn variant="ghost" onClick={() => void loadFiles("refresh")} loading={refreshingFiles}>
              <RefreshCcw className="mr-1.5 inline-block h-4 w-4" />
              Reload Files
            </RetroBtn>
            <RetroBtn onClick={showNewFileInput}>
              <FilePlus2 className="mr-1.5 inline-block h-4 w-4" />
              New Config
            </RetroBtn>
          </div>
        </div>
      </div>

      {loadError && (
        <DataState
          tone="danger"
          icon={<CircleAlert className="h-4 w-4" />}
          title={configs.length > 0 ? "File index stale" : "Config files unavailable"}
          message={configs.length > 0 ? `Keeping the last file index visible. Backend said: ${loadError}` : loadError}
          action={
            <RetroBtn size="sm" variant="ghost" onClick={() => void loadFiles("refresh")} loading={refreshingFiles}>
              Retry
            </RetroBtn>
          }
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* File sidebar */}
        <aside className="space-y-3 overflow-y-auto pr-1 lg:max-h-[calc(100vh-17rem)]">
          <div className="rounded-[12px] border-2 border-black bg-surface p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FolderTree className="h-4 w-4 text-text-muted" />
                <h2 className="font-heading text-xs uppercase tracking-wider text-text">Files</h2>
              </div>
              <button
                type="button"
                onClick={showNewFileInput}
                className="font-mono text-xs text-primary hover:underline"
              >
                + New
              </button>
            </div>

            {showNewFile && (
              <div className="mb-3 flex gap-1">
                <input
                  ref={newFileInputRef}
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCreateFile();
                    if (e.key === "Escape") setShowNewFile(false);
                  }}
                  placeholder="config.yaml"
                  className="min-w-0 flex-1 rounded border border-black bg-background px-2 py-1 font-mono text-xs text-text outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleCreateFile()}
                  className="rounded border border-black bg-primary px-2 py-1 font-mono text-xs text-black"
                >
                  Add
                </button>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  <span>Configs</span>
                  <span>{configs.length}</span>
                </div>
                {configs.length === 0 ? (
                  <p className="font-mono text-[10px] italic text-text-muted">empty</p>
                ) : (
                  <div className="space-y-0.5">
                    {configs.map((name) => (
                      <div key={name} className="group flex items-center">
                        <div className="min-w-0 flex-1">{renderFileButton(name, "config")}</div>
                        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          {activeConfig === name ? (
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" title="Active config" />
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleSetActive(name)}
                              className="rounded px-1 py-0.5 font-mono text-[9px] text-text-muted hover:text-text"
                              title="Set as active"
                            >
                              Live
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(name)}
                            className="rounded px-1 py-0.5 font-mono text-[9px] text-danger hover:text-danger/80"
                            title="Delete config"
                          >
                            Del
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  <span>Proxy Providers</span>
                  <span>{providers.length}</span>
                </div>
                {providers.length === 0 ? (
                  <p className="font-mono text-[10px] italic text-text-muted">empty</p>
                ) : (
                  <div className="space-y-0.5">{providers.map((name) => renderFileButton(name, "provider"))}</div>
                )}
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  <span>Rule Providers</span>
                  <span>{rules.length}</span>
                </div>
                {rules.length === 0 ? (
                  <p className="font-mono text-[10px] italic text-text-muted">empty</p>
                ) : (
                  <div className="space-y-0.5">{rules.map((name) => renderFileButton(name, "rules"))}</div>
                )}
              </div>
            </div>
          </div>

          <DataState
            tone={dirtyCount > 0 ? "warning" : "neutral"}
            icon={dirtyCount > 0 ? <FileWarning className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
            title={dirtyCount > 0 ? "Unsaved buffer" : "Save gate clear"}
            message={dirtyCount > 0 ? "Local edits are only in this browser until you save. Config files validate before save." : "Config saves are guarded by validation. Provider and rule files save directly."}
            className="shadow-none"
          />
        </aside>

        {/* Editor area */}
        <section className="flex min-h-[620px] flex-col overflow-hidden">
          {tabs.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-[12px] border-2 border-dashed border-border bg-surface/60 p-6">
              <DataState
                tone="neutral"
                icon={<FileCode2 className="h-4 w-4" />}
                title="No file open"
                message="Select a config, proxy provider, or rule provider from the left rail. Config files can be validated before saving."
                action={<RetroBtn size="sm" onClick={showNewFileInput}>New Config</RetroBtn>}
              />
            </div>
          ) : (
            <>
              {/* Tabs bar */}
              <div className="flex items-center gap-0.5 overflow-x-auto rounded-t-[10px] border-2 border-black bg-surface">
                {tabs.map((tab) => (
                  <div
                    key={tab.name}
                    className={cn(
                      "group flex items-center border-r-2 border-black font-mono text-xs transition-colors",
                      activeTab === tab.name
                        ? "bg-background text-text"
                        : "bg-surface text-text-muted hover:bg-background/50"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveTab(tab.name)}
                      className="flex items-center gap-1.5 px-3 py-2"
                    >
                      {tab.dirty && <span className="h-2 w-2 rounded-full bg-warning" title="Unsaved changes" />}
                      <span className="max-w-32 truncate">{tab.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => closeTab(tab.name, e)}
                      className="mr-2 rounded px-1 text-[10px] opacity-0 group-hover:opacity-100 hover:bg-danger hover:text-white"
                      aria-label={`Close ${tab.name}`}
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>

              {/* Toolbar */}
              <div className="border-x-2 border-black bg-surface px-3 py-2">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="info">{tabs.length} open</Badge>
                    {dirtyCount > 0 && <Badge variant="warning">{dirtyCount} unsaved</Badge>}
                    {activeFile && activeConfig === activeFile.name && <Badge variant="success">active</Badge>}
                    {activeFile?.type === "config" && activeValidation?.valid && <Badge variant="success">validated</Badge>}
                    {activeFile?.type === "config" && activeValidation && !activeValidation.valid && <Badge variant="danger">invalid</Badge>}
                    {configValidationCount > 0 && <Badge variant="default">{configValidationCount} passed</Badge>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {activeFile && (
                      <RetroBtn
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDiff((prev) => !prev)}
                        className={cn(showDiff && "bg-black/20 text-white")}
                        title="Toggle side-by-side diff overlay (Alt+D)"
                      >
                        Diff View
                      </RetroBtn>
                    )}
                    {activeFile?.type === "config" && (
                      <RetroBtn
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleValidate()}
                        loading={validating === activeFile.name}
                        title="Validate configuration (Alt+V)"
                      >
                        <ShieldCheck className="mr-1.5 inline-block h-3.5 w-3.5" />
                        Validate
                      </RetroBtn>
                    )}
                    {activeFile?.dirty && (
                      <RetroBtn
                        variant="ghost"
                        size="sm"
                        onClick={handleRevertCurrent}
                        title="Discard local changes (Ctrl+Alt+Z or Ctrl+Alt+R)"
                      >
                        <RotateCcw className="mr-1.5 inline-block h-3.5 w-3.5" />
                        Revert Draft
                      </RetroBtn>
                    )}
                    {activeFile && activeConfig !== activeFile.name && activeFile.type === "config" && (
                      <RetroBtn
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleSetActive(activeFile.name)}
                        disabled={activeFile.dirty}
                        title="Set as active config"
                      >
                        <Power className="mr-1.5 inline-block h-3.5 w-3.5" />
                        Set Active
                      </RetroBtn>
                    )}
                    <RetroBtn
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleSaveAll()}
                      disabled={dirtyCount === 0}
                      loading={saving !== null && dirtyCount > 1}
                      title="Save all modified files (Ctrl+Shift+S)"
                    >
                      Save All
                    </RetroBtn>
                    <RetroBtn
                      variant="primary"
                      size="sm"
                      onClick={handleSave}
                      disabled={!activeFile?.dirty}
                      loading={saving === activeFile?.name}
                      title="Save current file (Ctrl+S)"
                    >
                      <Save className="mr-1.5 inline-block h-3.5 w-3.5" />
                      Save Draft
                    </RetroBtn>
                  </div>
                </div>
              </div>

              {activeFile && (
                <div className="grid gap-3 border-x-2 border-t-2 border-black bg-background p-3 md:grid-cols-4">
                  <MetaTile label="File" value={activeFile.name} detail={formatFileType(activeFile.type)} />
                  <MetaTile label="State" value={activeFile.dirty ? "Unsaved" : "Saved"} detail={activeFile.dirty ? "Local browser buffer" : "Matches last loaded copy"} />
                  <MetaTile label="Size" value={`${formatLineCount(activeFile.content)} lines`} detail={`${activeFile.content.length.toLocaleString()} chars`} />
                  <MetaTile label="Runtime" value={activeConfig === activeFile.name ? "Active" : "Inactive"} detail={activeFile.type === "config" ? "Mihomo config slot" : "Referenced by config"} />
                </div>
              )}

              {/* Monaco Editor */}
              <div className="flex-1 overflow-hidden rounded-b-[10px] border-2 border-t-0 border-black">
                {activeFile && (
                  showDiff ? (
                    <DiffEditor
                      key={`diff-${activeFile.name}`}
                      language="yaml"
                      theme="vs-dark"
                      original={activeFile.savedContent}
                      modified={activeFile.content}
                      onMount={handleDiffMount}
                      options={{
                        fontSize: 13,
                        fontFamily: "JetBrains Mono, monospace",
                        minimap: { enabled: true },
                        scrollBeyondLastLine: false,
                        lineNumbers: "on",
                        renderWhitespace: "selection",
                        bracketPairColorization: { enabled: true },
                        automaticLayout: true,
                        padding: { top: 8 },
                        originalEditable: false,
                      }}
                    />
                  ) : (
                    <Editor
                      key={activeFile.name}
                      language="yaml"
                      theme="vs-dark"
                      value={activeFile.content}
                      onChange={handleEditorChange}
                      onMount={handleEditorMount}
                      options={{
                        fontSize: 13,
                        fontFamily: "JetBrains Mono, monospace",
                        minimap: { enabled: true },
                        scrollBeyondLastLine: false,
                        lineNumbers: "on",
                        tabSize: 2,
                        renderWhitespace: "selection",
                        bracketPairColorization: { enabled: true },
                        automaticLayout: true,
                        padding: { top: 8 },
                      }}
                    />
                  )
                )}
              </div>

              {activeFile?.type === "config" && activeValidation && (
                <div className="mt-4 rounded-[12px] border-2 border-black bg-surface p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {activeValidation.valid ? (
                          <CircleCheckBig className="h-4 w-4 text-primary" />
                        ) : (
                          <FileWarning className="h-4 w-4 text-danger" />
                        )}
                        <h3 className="font-heading text-sm uppercase tracking-wide text-text">Validation Result</h3>
                      </div>
                      <p className="mt-2 font-mono text-sm text-text-muted">{activeValidation.summary}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activeValidation.checked_with.map((item: string) => (
                        <Badge key={item} variant="info">{item}</Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {activeValidation.issues.length === 0 ? (
                      <DataState
                        tone="success"
                        icon={<ShieldCheck className="h-4 w-4" />}
                        title="No validation issues"
                        message="This draft passed the available config checks and is safe to save. Activating still changes runtime selection."
                        className="shadow-none lg:col-span-2"
                      />
                    ) : (
                      activeValidation.issues.map((issue) => (
                        <button
                          type="button"
                          key={`${issue.source}-${issue.level}-${issue.line || 0}-${issue.column || 0}-${issue.message}`}
                          onClick={() => handleJumpToError(issue.line, issue.column)}
                          disabled={!issue.line}
                          className={`w-full text-left rounded-[10px] border-2 border-black bg-black/10 p-3 focus:outline-none transition-colors ${
                            issue.line ? "cursor-pointer hover:bg-black/15 active:bg-black/20" : ""
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <CircleAlert className={`mt-0.5 h-4 w-4 ${issue.level === "error" ? "text-danger" : "text-warning"}`} />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={issue.level === "error" ? "danger" : issue.level === "warning" ? "warning" : "info"}>
                                  {issue.level}
                                </Badge>
                                <Badge variant="default">{issue.source}</Badge>
                                {(issue.line || issue.column) && (
                                  <Badge variant="default">L{issue.line ?? "?"}:C{issue.column ?? "?"}</Badge>
                                )}
                              </div>
                              <p className="mt-2 break-words font-mono text-sm text-text">{issue.message}</p>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <Modal open={!!deleteTarget} title="Delete Config" onClose={() => setDeleteTarget(null)}>
        <div className="space-y-4">
          <DataState
            tone="danger"
            icon={<Trash2 className="h-4 w-4" />}
            title="Destructive config removal"
            message="This deletes the config file from the backend. Do this only when it is not the active runtime config and no rollout depends on it."
            className="shadow-none"
          />
          <div className="rounded-[12px] border-2 border-danger/40 bg-danger/10 px-3 py-3">
            <p className="font-heading text-sm uppercase tracking-wide text-text">{deleteTarget}</p>
            <p className="mt-1 font-mono text-xs text-text-muted">
              Active config: {activeConfig || "unknown"}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <RetroBtn size="sm" variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </RetroBtn>
            <RetroBtn size="sm" variant="danger" onClick={() => void confirmDelete()} loading={deleting} disabled={deleteTarget === activeConfig}>
              Delete Config
            </RetroBtn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

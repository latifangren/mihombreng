"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useModalAccessibility } from "@/hooks/use-modal-accessibility";
import { Card } from "@/components/ui/card";
import { RetroBtn } from "@/components/ui/retro-btn";
import { Badge } from "@/components/ui/badge";
import { SkeletonFileItem } from "@/components/ui/skeleton";
import { mihomoApi } from "@/services/api";
import {
  FileText,
  Trash2,
  FolderOpen,
  Download,
  Pencil,
  FolderPlus,
  Upload,
  X,
  Check,
} from "lucide-react";
import toast from "react-hot-toast";

// ── Types ──
type FileDir = "configs" | "proxy-provider" | "rule-provider";

type FileSection = {
  dir: FileDir;
  label: string;
  badgeVariant: "info" | "warning" | "success";
  badgeLabel: string;
};

const SECTIONS: FileSection[] = [
  { dir: "configs", label: "Config Files", badgeVariant: "info", badgeLabel: "config" },
  { dir: "proxy-provider", label: "Proxy Providers", badgeVariant: "warning", badgeLabel: "provider" },
  { dir: "rule-provider", label: "Rule Providers", badgeVariant: "success", badgeLabel: "rules" },
];

// ── API helpers per section ──
function apiFor(dir: FileDir) {
  return {
    list: () => mihomoApi._listFiles(dir),
    create: (f: string) => mihomoApi._createFile(dir, f),
    upload: (file: File) => mihomoApi._uploadFile(dir, file),
    rename: (f: string, n: string) => mihomoApi._renameFile(dir, f, n),
    download: (f: string) => mihomoApi._downloadFile(dir, f),
    delete: (f: string) => mihomoApi._deleteFile(dir, f),
  };
}

// ── Inline Modal Shell ──
function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const containerRef = useModalAccessibility(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div ref={containerRef} className="w-full max-w-sm rounded-[12px] border-2 border-black bg-surface p-6 shadow-brutal outline-none">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-sm uppercase tracking-wider text-text">{title}</h3>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text" aria-label="Close modal">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Rename Row ──
function RenameRow({
  original,
  onRename,
  onCancel,
}: {
  original: string;
  onRename: (newName: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(original);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);
  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && val.trim() && val !== original) onRename(val.trim());
          if (e.key === "Escape") onCancel();
        }}
        className="flex-1 rounded-[8px] border-2 border-border bg-background px-3 py-1.5 font-mono text-sm text-text outline-none focus:border-primary"
      />
      <button
        type="button"
        onClick={() => val.trim() && val !== original && onRename(val.trim())}
        className="text-primary hover:text-primary-active"
        aria-label="Confirm rename"
      >
        <Check className="h-4 w-4" />
      </button>
      <button type="button" onClick={onCancel} className="text-text-muted hover:text-text" aria-label="Cancel rename">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Create Input (auto-focus via ref) ──
function CreateInput({
  value,
  onChange,
  onSubmit,
  onClose,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onSubmit();
        if (e.key === "Escape") onClose();
      }}
      placeholder="filename.yaml"
      className="w-full rounded-[8px] border-2 border-border bg-background px-3 py-2 font-mono text-sm text-text outline-none focus:border-primary"
    />
  );
}

// ── File List Item ──
function FileItem({
  name,
  badgeVariant,
  badgeLabel,
  onRename,
  onDownload,
  onDelete,
}: {
  name: string;
  badgeVariant: "info" | "warning" | "success";
  badgeLabel: string;
  onRename: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const isMd = name.endsWith(".md");
  return (
    <div className="flex items-center justify-between rounded-[8px] border border-border bg-background px-4 py-2.5">
      <span className="font-mono text-sm text-text truncate mr-2">{name}</span>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={isMd ? "info" : badgeVariant}>{isMd ? "doc" : badgeLabel}</Badge>
        {!isMd && (
          <button type="button" onClick={onRename} className="text-text-muted hover:text-info" title="Rename" aria-label={`Rename ${name}`}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        <button type="button" onClick={onDownload} className="text-text-muted hover:text-primary" title="Download" aria-label={`Download ${name}`}>
          <Download className="h-3.5 w-3.5" />
        </button>
        {!isMd && (
          <button type="button" onClick={onDelete} className="text-text-muted hover:text-danger" title="Delete" aria-label={`Delete ${name}`}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Section Card ──
function FileSectionCard({
  section,
  loading,
}: {
  section: FileSection;
  loading: boolean;
}) {
  const { dir, label, badgeVariant, badgeLabel } = section;
  const api = useMemo(() => apiFor(dir), [dir]);

  const [files, setFiles] = useState<string[]>([]);
  const [sectionLoading, setSectionLoading] = useState(true);
  const [renaming, setRenaming] = useState<string | null>(null);

  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setSectionLoading(true);
    try {
      const list = await api.list();
      setFiles(list);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to load ${label.toLowerCase()}`);
    } finally {
      setSectionLoading(false);
    }
  }, [api, label]);

  useEffect(() => {
    if (!loading) {
      void refresh();
    }
  }, [loading, refresh]);

  const handleCreate = async () => {
    if (!createName.trim()) return;
    try {
      await api.create(createName.trim());
      toast.success(`${createName.trim()} created`);
      setShowCreate(false);
      setCreateName("");
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error("Create failed");
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await api.upload(file);
      toast.success(`${file.name} uploaded`);
      setShowUpload(false);
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error("Upload failed");
    }
    if (uploadRef.current) uploadRef.current.value = "";
  };

  const handleRename = async (oldName: string, newName: string) => {
    try {
      await api.rename(oldName, newName);
      toast.success(`Renamed to ${newName}`);
      setRenaming(null);
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error("Rename failed");
    }
  };

  const handleDownload = async (name: string) => {
    try {
      await api.download(name);
      toast.success(`${name} downloaded`);
    } catch (err) {
      console.error(err);
      toast.error("Download failed");
    }
  };

  const handleDelete = async (name: string) => {
    try {
      await api.delete(name);
      toast.success(`${name} deleted`);
      setShowDeleteConfirm(null);
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error("Delete failed");
    }
  };

  const listLoading = loading || sectionLoading;

  return (
    <>
      <Card
        title={label}
        icon={<FileText className="h-4 w-4" />}
        action={
          <div className="flex gap-2">
            <RetroBtn variant="ghost" size="sm" onClick={() => setShowCreate(true)}>
              <FolderPlus className="mr-1 inline h-3 w-3" /> Create
            </RetroBtn>
            <RetroBtn variant="ghost" size="sm" onClick={() => setShowUpload(true)}>
              <Upload className="mr-1 inline h-3 w-3" /> Upload
            </RetroBtn>
          </div>
        }
      >
        {listLoading ? (
          <div className="space-y-2">
            <SkeletonFileItem />
            <SkeletonFileItem />
            <SkeletonFileItem />
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6">
            <FolderOpen className="h-8 w-8 text-text-muted" />
            <p className="font-mono text-sm text-text-muted">No files found</p>
          </div>
        ) : (
          <div className="space-y-1">
            {files.map((name) =>
              renaming === name ? (
                <RenameRow
                  key={name}
                  original={name}
                  onRename={(n) => handleRename(name, n)}
                  onCancel={() => setRenaming(null)}
                />
              ) : (
                <FileItem
                  key={name}
                  name={name}
                  badgeVariant={badgeVariant}
                  badgeLabel={badgeLabel}
                  onRename={() => setRenaming(name)}
                  onDownload={() => handleDownload(name)}
                  onDelete={() => setShowDeleteConfirm(name)}
                />
              )
            )}
          </div>
        )}
      </Card>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={`Create ${label}`}>
        <div className="space-y-4">
          <CreateInput value={createName} onChange={setCreateName} onSubmit={handleCreate} onClose={() => setShowCreate(false)} />
          <div className="flex justify-end gap-2">
            <RetroBtn variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
              Cancel
            </RetroBtn>
            <RetroBtn variant="primary" size="sm" onClick={handleCreate} disabled={!createName.trim()}>
              Create
            </RetroBtn>
          </div>
        </div>
      </Modal>

      {/* Upload Modal */}
      <Modal open={showUpload} onClose={() => setShowUpload(false)} title={`Upload ${label}`}>
        <div className="space-y-4">
          <p className="font-mono text-xs text-text-muted">Accepts .yaml / .yml files</p>
          <input
            ref={uploadRef}
            type="file"
            accept=".yaml,.yml"
            onChange={handleUpload}
            className="block w-full text-sm text-text-muted file:mr-3 file:rounded-[8px] file:border-2 file:border-border file:bg-surface-hover file:px-4 file:py-1.5 file:font-heading file:text-xs file:uppercase file:text-text hover:file:bg-primary/20"
          />
          <div className="flex justify-end">
            <RetroBtn variant="ghost" size="sm" onClick={() => setShowUpload(false)}>
              Cancel
            </RetroBtn>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(null)}
        title="Confirm Delete"
      >
        <div className="space-y-4">
          <p className="font-mono text-sm text-text">
            Delete <span className="font-bold text-danger">{showDeleteConfirm}</span>?
          </p>
          <div className="flex justify-end gap-2">
            <RetroBtn variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(null)}>
              Cancel
            </RetroBtn>
            <RetroBtn
              variant="danger"
              size="sm"
              onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
            >
              Delete
            </RetroBtn>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ── Page ──
export default function ManagerPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      mihomoApi.getConfigs(),
      mihomoApi.getProxyProviders(),
      mihomoApi.getRuleProviders(),
    ])
      .then(() => {})
      .catch(() => toast.error("Failed to load files"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl uppercase tracking-wide text-text">File Manager</h1>
        <p className="mt-1 font-mono text-xs text-text-muted">Create, upload, rename, download, delete configs & providers</p>
      </div>

      {SECTIONS.map((s) => (
        <FileSectionCard key={s.dir} section={s} loading={loading} />
      ))}
    </div>
  );
}

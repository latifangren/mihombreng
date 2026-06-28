import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { DataState, FreshnessPill } from "@/components/ui/data-state";
import { RetroBtn } from "@/components/ui/retro-btn";
import { Skeleton } from "@/components/ui/skeleton";
import { configApi } from "@/services/api";
import type { DiagnosticsCheck } from "@/types";
import { Activity, CheckCircle2, CircleAlert, Copy, RefreshCcw, ShieldCheck, XCircle } from "lucide-react";
import toast from "react-hot-toast";

const severityStyle: Record<string, { icon: ReactNode; badge: string; panel: string }> = {
  success: {
    icon: <CheckCircle2 className="h-4 w-4 text-primary" />,
    badge: "bg-primary/15 text-primary",
    panel: "border-primary/60 bg-primary/5",
  },
  warning: {
    icon: <CircleAlert className="h-4 w-4 text-warning" />,
    badge: "bg-warning/15 text-warning",
    panel: "border-warning/70 bg-warning/5",
  },
  failure: {
    icon: <XCircle className="h-4 w-4 text-danger" />,
    badge: "bg-danger/15 text-danger",
    panel: "border-danger/70 bg-danger/5",
  },
};

const categoryLabel: Record<string, string> = {
  runtime: "Runtime",
  network: "Network",
  dns: "DNS",
  filesystem: "Filesystem",
};

async function writeClipboardText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const copied = document.execCommand("copy");
    if (!copied) throw new Error("Clipboard command was rejected");
  } finally {
    document.body.removeChild(textarea);
  }
}

function DiagnosticsSkeleton() {
  return (
    <div className="space-y-3">
      {["runtime", "network", "dns"].map((key) => (
        <div key={key} className="rounded-[12px] border-2 border-black bg-black/10 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <Skeleton width="180px" height="14px" />
              <Skeleton width="320px" height="12px" className="max-w-full" />
            </div>
            <Skeleton width="70px" height="28px" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DiagnosticsPage() {
  const [checks, setChecks] = useState<DiagnosticsCheck[]>([]);
  const [generatedAt, setGeneratedAt] = useState("");
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedCheckId, setCopiedCheckId] = useState<string | null>(null);

  const load = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "init") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    try {
      const res = await configApi.getDiagnostics();
      setChecks(res.checks || []);
      setGeneratedAt(res.generated_at || "");
      setLastLoadedAt(new Date());
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load diagnostics";
      setError(message);
      toast.error(message);
    } finally {
      if (mode === "init") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    return checks.reduce(
      (acc, check) => {
        acc.total += 1;
        if (check.severity === "success") acc.success += 1;
        if (check.severity === "warning") acc.warning += 1;
        if (check.severity === "failure") acc.failure += 1;
        acc.categories.add(check.category);
        return acc;
      },
      { total: 0, success: 0, warning: 0, failure: 0, categories: new Set<string>() }
    );
  }, [checks]);

  const headline = summary.failure > 0 ? "Action needed" : summary.warning > 0 ? "Watch warnings" : summary.total > 0 ? "System clear" : "Awaiting scan";
  const headlineTone = summary.failure > 0 ? "text-danger" : summary.warning > 0 ? "text-warning" : "text-primary";

  const copyCheck = async (check: DiagnosticsCheck) => {
    const text = [
      `${check.label} [${check.severity}]`,
      check.summary,
      check.value ? `Value: ${check.value}` : "",
      check.details ? `Details: ${check.details}` : "",
      check.action ? `Action: ${check.action}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      await writeClipboardText(text);
      setCopiedCheckId(check.id);
      window.setTimeout(() => setCopiedCheckId((current) => (current === check.id ? null : current)), 1800);
      toast.success(`Copied ${check.label}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Clipboard unavailable";
      toast.error(`Copy failed: ${message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[16px] border-2 border-black bg-surface p-5 shadow-[8px_8px_0_#000]">
        <div className="absolute right-[-60px] top-[-80px] h-44 w-44 rounded-full border-2 border-black bg-primary/10" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl uppercase tracking-wide text-text">Diagnostics</h1>
              <FreshnessPill loading={loading || refreshing} error={error} lastUpdatedAt={lastLoadedAt} stale={Boolean(error && checks.length > 0)} />
            </div>
            <p className="mt-2 font-mono text-xs uppercase tracking-wider text-text-muted">
              Runtime, outbound network, DNS, and filesystem checks without SSH
            </p>
            <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Health posture</p>
                <p className={`font-heading text-4xl uppercase tracking-wide ${headlineTone}`}>{headline}</p>
              </div>
              <div className="pb-1 font-mono text-xs text-text-muted">
                {summary.total} checks / {summary.categories.size} domains
              </div>
            </div>
          </div>
          <RetroBtn onClick={() => void load("refresh")} loading={refreshing}>
            <RefreshCcw className="mr-1.5 inline-block h-4 w-4" />
            {refreshing ? "Refreshing..." : "Run Diagnostics"}
          </RetroBtn>
        </div>
      </div>

      {error && (
        <DataState
          tone="danger"
          icon={<CircleAlert className="h-4 w-4" />}
          title={checks.length > 0 ? "Diagnostics stale" : "Diagnostics unavailable"}
          message={checks.length > 0 ? `Last successful report remains visible. Backend said: ${error}` : error}
          action={
            <RetroBtn size="sm" variant="ghost" onClick={() => void load("refresh")} loading={refreshing}>
              Retry
            </RetroBtn>
          }
        />
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card title="Checks" icon={<Activity className="h-4 w-4" />} className="p-4">
          <div className="font-heading text-3xl text-text">{loading ? "—" : summary.total}</div>
        </Card>
        <Card title="Success" icon={<CheckCircle2 className="h-4 w-4 text-primary" />} className="p-4">
          <div className="font-heading text-3xl text-primary">{loading ? "—" : summary.success}</div>
        </Card>
        <Card title="Warnings" icon={<CircleAlert className="h-4 w-4 text-warning" />} className="p-4">
          <div className="font-heading text-3xl text-warning">{loading ? "—" : summary.warning}</div>
        </Card>
        <Card title="Failures" icon={<XCircle className="h-4 w-4 text-danger" />} className="p-4">
          <div className="font-heading text-3xl text-danger">{loading ? "—" : summary.failure}</div>
        </Card>
      </div>

      <Card
        title="Latest run"
        icon={<ShieldCheck className="h-4 w-4" />}
        action={<span className="font-mono text-xs text-text-muted">{generatedAt || "No report timestamp"}</span>}
      >
        {loading ? (
          <DiagnosticsSkeleton />
        ) : checks.length === 0 && !error ? (
          <DataState
            tone="neutral"
            icon={<Activity className="h-4 w-4" />}
            title="No diagnostics reported"
            message="Backend returned an empty health report. Run diagnostics again after Mihomo has produced runtime state."
            action={
              <RetroBtn size="sm" variant="ghost" onClick={() => void load("refresh")} loading={refreshing}>
                Refresh
              </RetroBtn>
            }
          />
        ) : (
          <div className="space-y-3">
            {checks.map((check) => {
              const visual = severityStyle[check.severity] || severityStyle.failure;
              return (
                <div key={check.id} className={`rounded-[12px] border-2 border-black p-4 ${visual.panel}`}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {visual.icon}
                        <span className="font-heading text-sm uppercase tracking-wide text-text">{check.label}</span>
                        <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider ${visual.badge}`}>
                          {check.severity}
                        </span>
                        <span className="rounded-full border border-black/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                          {categoryLabel[check.category] || check.category}
                        </span>
                      </div>
                      <p className="mt-2 font-mono text-sm text-text">{check.summary}</p>
                      {check.value && <p className="mt-2 break-words font-mono text-xs text-text-muted">Value: {check.value}</p>}
                      {check.details && <p className="mt-2 break-words font-mono text-xs text-text-muted">{check.details}</p>}
                      {check.action && <p className="mt-3 font-mono text-xs text-warning">Next: {check.action}</p>}
                    </div>
                    <RetroBtn size="sm" variant={copiedCheckId === check.id ? "primary" : "ghost"} onClick={() => void copyCheck(check)}>
                      <Copy className="mr-1.5 inline-block h-3.5 w-3.5" />
                      {copiedCheckId === check.id ? "Copied" : "Copy"}
                    </RetroBtn>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

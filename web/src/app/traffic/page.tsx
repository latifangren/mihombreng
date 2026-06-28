"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { DataState, FreshnessPill } from "@/components/ui/data-state";
import { RetroBtn } from "@/components/ui/retro-btn";
import { Skeleton } from "@/components/ui/skeleton";
import { mihomoApi } from "@/services/api";
import type { TrafficMetrics, TrafficMetricBucket } from "@/types";
import { formatBytes } from "@/utils/format";
import { Activity, ArrowDownToLine, ArrowUpFromLine, BarChart3, CircleAlert, Globe, Network, Play, Pause, RefreshCcw, Wifi } from "lucide-react";
import toast from "react-hot-toast";
import { RetroBandwidthChart } from "@/components/status/retro-bandwidth-chart";

const BUCKET_ICONS: Record<string, typeof Globe> = {
  by_rule: BarChart3,
  by_chain: Network,
  by_network: Globe,
  by_type: Wifi,
};

const BUCKET_LABELS: Record<string, string> = {
  by_rule: "By Rule",
  by_chain: "By Proxy Chain",
  by_network: "By Network",
  by_type: "By Connection Type",
};

function bucketTotal(bucket: TrafficMetricBucket) {
  return bucket.download + bucket.upload;
}

function BucketTable({ label, buckets, grandTotal }: { label: string; buckets: TrafficMetricBucket[]; grandTotal: number }) {
  const Icon = BUCKET_ICONS[label] || Activity;
  const sorted = useMemo(
    () => [...buckets].sort((a, b) => bucketTotal(b) - bucketTotal(a)),
    [buckets]
  );

  if (sorted.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-text-muted" />
          <p className="font-heading text-xs uppercase tracking-wide text-text">{BUCKET_LABELS[label] || label}</p>
        </div>
        <DataState
          className="mt-4 shadow-none"
          title="No slices yet"
          message="This bucket has no active connection totals in current Mihomo snapshot."
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b-2 border-black bg-black/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-text" />
          <span className="font-heading text-xs uppercase tracking-wide text-text">{BUCKET_LABELS[label] || label}</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">Top {sorted.length}</span>
      </div>
      <div className="divide-y divide-black/10">
        {sorted.map((b, index) => {
          const total = bucketTotal(b);
          const share = grandTotal > 0 ? Math.max(4, Math.round((total / grandTotal) * 100)) : 0;
          return (
            <div key={`${label}-${b.key || index}`} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate font-mono text-xs text-text" title={b.key}>
                  {b.key || "—"}
                </span>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-xs text-text-muted">{b.connections} conn</span>
                  <span className="hidden items-center gap-1 font-mono text-xs text-primary sm:flex">
                    <ArrowDownToLine className="h-3 w-3" />
                    {formatBytes(b.download)}
                  </span>
                  <span className="hidden items-center gap-1 font-mono text-xs text-secondary sm:flex">
                    <ArrowUpFromLine className="h-3 w-3" />
                    {formatBytes(b.upload)}
                  </span>
                </div>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full border border-black bg-background">
                <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TrafficSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {["connections", "download", "upload", "rules"].map((key) => (
          <Card key={key} className="p-4">
            <Skeleton width="90px" height="12px" />
            <Skeleton width="120px" height="24px" className="mt-3" />
          </Card>
        ))}
      </div>
      <Card>
        <Skeleton width="180px" height="14px" />
        <Skeleton width="100%" height="80px" className="mt-4" />
      </Card>
    </div>
  );
}

export default function TrafficPage() {
  const [metrics, setMetrics] = useState<TrafficMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);

  const [history, setHistory] = useState<Array<{ time: string; down: number; up: number }>>([]);
  const [zoomLimit, setZoomLimit] = useState(60);
  const [paused, setPaused] = useState(false);

  const loadMetrics = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "init") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    try {
      const data = await mihomoApi.getTrafficMetrics();
      setMetrics(data);
      setLastLoadedAt(new Date());
      setError(null);
      if (mode === "refresh") toast.success("Traffic metrics refreshed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load traffic metrics";
      setError(message);
      toast.error(message);
    } finally {
      if (mode === "init") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadMetrics();
    const id = setInterval(() => {
      void loadMetrics();
    }, 5000);
    return () => clearInterval(id);
  }, [loadMetrics]);

  useEffect(() => {
    if (paused) return;

    const poll = async () => {
      try {
        const stats = await mihomoApi.getTraffic();
        const nowStr = new Date().toLocaleTimeString();
        setHistory((prev) => {
          const next = [...prev, { time: nowStr, down: stats.down, up: stats.up }];
          return next.slice(-300); // Max 300 data points (5 minutes)
        });
      } catch (err) {
        console.error("Traffic poll error:", err);
      }
    };

    void poll();
    const id = setInterval(poll, 1000);
    return () => clearInterval(id);
  }, [paused]);

  const data = metrics;
  const grandTotal = data ? data.downloadTotal + data.uploadTotal : 0;
  const downloadShare = grandTotal > 0 && data ? Math.round((data.downloadTotal / grandTotal) * 100) : 0;
  const uploadShare = grandTotal > 0 ? 100 - downloadShare : 0;
  const activeBuckets = data ? [data.by_rule, data.by_chain, data.by_network, data.by_type].reduce((sum, bucket) => sum + bucket.length, 0) : 0;
  const isEmpty = Boolean(data && data.connections === 0 && grandTotal === 0 && activeBuckets === 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-2xl uppercase tracking-wide text-text">Traffic Metrics</h1>
            <FreshnessPill loading={loading || refreshing} error={error} lastUpdatedAt={lastLoadedAt} stale={Boolean(error && data)} />
          </div>
          <p className="mt-1 font-mono text-xs text-text-muted">Live aggregation from Mihomo core connections</p>
        </div>
        <RetroBtn variant="ghost" size="sm" onClick={() => void loadMetrics("refresh")} loading={refreshing}>
          <RefreshCcw className="mr-1.5 inline-block h-3.5 w-3.5" />
          Refresh
        </RetroBtn>
      </div>

      {error && (
        <DataState
          tone="danger"
          icon={<CircleAlert className="h-4 w-4" />}
          title={data ? "Traffic snapshot stale" : "Traffic metrics unavailable"}
          message={data ? `Keeping last successful snapshot visible. Backend said: ${error}` : error}
          action={
            <RetroBtn size="sm" variant="ghost" onClick={() => void loadMetrics("refresh")} loading={refreshing}>
              Retry
            </RetroBtn>
          }
        />
      )}

      {loading ? (
        <TrafficSkeleton />
      ) : !data ? (
        <DataState
          tone="danger"
          icon={<CircleAlert className="h-4 w-4" />}
          title="No traffic snapshot"
          message="Mihomo traffic endpoint did not return usable data. Retry once backend is reachable."
          action={
            <RetroBtn size="sm" variant="ghost" onClick={() => void loadMetrics("refresh")} loading={refreshing}>
              Retry
            </RetroBtn>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border-2 border-black bg-surface p-3 shadow-[4px_4px_0_#000]">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase text-text-muted">Window:</span>
              {[
                { label: "1m", value: 60 },
                { label: "2m", value: 120 },
                { label: "5m", value: 300 },
              ].map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setZoomLimit(opt.value)}
                  className={`rounded border-2 border-black px-2 py-0.5 font-mono text-[10px] shadow-[2px_2px_0_#000] focus:outline-none active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_#000] ${
                    zoomLimit === opt.value
                      ? "bg-primary text-background font-bold"
                      : "bg-background hover:bg-black/5"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setPaused((prev) => !prev)}
              className="flex items-center gap-1.5 rounded border-2 border-black bg-background px-3 py-1 font-heading text-[10px] uppercase shadow-[2px_2px_0_#000] focus:outline-none active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0_#000] hover:bg-black/5"
            >
              {paused ? (
                <>
                  <Play className="h-3 w-3 text-primary fill-primary" />
                  Resume
                </>
              ) : (
                <>
                  <Pause className="h-3 w-3 text-danger fill-danger" />
                  Pause
                </>
              )}
            </button>
          </div>

          <RetroBandwidthChart data={history.slice(-zoomLimit)} maxPoints={zoomLimit} />

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card className="p-4">
              <p className="font-heading text-xs uppercase tracking-wide text-text-muted">Connections</p>
              <p className="mt-1 font-mono text-2xl text-text">{data.connections}</p>
            </Card>
            <Card className="p-4">
              <p className="font-heading text-xs uppercase tracking-wide text-text-muted">Download Total</p>
              <p className="mt-1 flex items-center gap-2 font-mono text-xl text-primary">
                <ArrowDownToLine className="h-4 w-4" />
                {formatBytes(data.downloadTotal)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="font-heading text-xs uppercase tracking-wide text-text-muted">Upload Total</p>
              <p className="mt-1 flex items-center gap-2 font-mono text-xl text-secondary">
                <ArrowUpFromLine className="h-4 w-4" />
                {formatBytes(data.uploadTotal)}
              </p>
            </Card>
            <Card className="p-4">
              <p className="font-heading text-xs uppercase tracking-wide text-text-muted">Active Slices</p>
              <p className="mt-1 font-mono text-2xl text-text">{activeBuckets}</p>
            </Card>
          </div>

          <Card title="Flow overview" icon={<Activity className="h-4 w-4" />}>
            {isEmpty ? (
              <DataState
                tone="neutral"
                icon={<Wifi className="h-4 w-4" />}
                title="Quiet line"
                message="No active traffic or grouped connections in this snapshot. Start traffic through the proxy, then refresh."
              />
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
                  <div className="rounded-[12px] border-2 border-black bg-primary/10 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Inbound pull</p>
                    <p className="mt-1 font-heading text-3xl text-primary">{downloadShare}%</p>
                  </div>
                  <div className="hidden h-1 w-16 rounded-full bg-black md:block" />
                  <div className="rounded-[12px] border-2 border-black bg-secondary/10 p-4 text-right">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Outbound push</p>
                    <p className="mt-1 font-heading text-3xl text-secondary">{uploadShare}%</p>
                  </div>
                </div>
                <div className="h-5 overflow-hidden rounded-full border-2 border-black bg-background">
                  <div className="h-full bg-primary" style={{ width: `${downloadShare}%` }} />
                </div>
                <p className="font-mono text-xs text-text-muted">
                  Total observed volume: {formatBytes(grandTotal)} across {data.connections} active connections.
                </p>
              </div>
            )}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <BucketTable label="by_rule" buckets={data.by_rule} grandTotal={grandTotal} />
            <BucketTable label="by_chain" buckets={data.by_chain} grandTotal={grandTotal} />
            <BucketTable label="by_network" buckets={data.by_network} grandTotal={grandTotal} />
            <BucketTable label="by_type" buckets={data.by_type} grandTotal={grandTotal} />
          </div>
        </>
      )}
    </div>
  );
}

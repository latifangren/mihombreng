"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useModalAccessibility } from "@/hooks/use-modal-accessibility";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataState, FreshnessPill } from "@/components/ui/data-state";
import { RetroBtn } from "@/components/ui/retro-btn";
import { Skeleton } from "@/components/ui/skeleton";
import { mihomoApi } from "@/services/api";
import type { ConnectionInfo, ConnectionsListResponse } from "@/types";
import { formatBytes } from "@/utils/format";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CircleAlert,
  Globe,
  Network,
  RefreshCcw,
  Search,
  Shield,
  ShieldX,
  Signal,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

function networkBadge(network: string) {
  if (network === "tcp") return <Badge variant="info">TCP</Badge>;
  if (network === "udp") return <Badge variant="warning">UDP</Badge>;
  return <Badge variant="default">{network || "—"}</Badge>;
}

function ruleBadge(rule: string) {
  if (rule === "MATCH") return <Badge variant="danger">MATCH</Badge>;
  if (rule === "DIRECT") return <Badge variant="success">DIRECT</Badge>;
  if (rule === "REJECT") return <Badge variant="warning">REJECT</Badge>;
  return <Badge variant="default">{rule || "—"}</Badge>;
}

function connectionLabel(conn: ConnectionInfo) {
  return conn.host || conn.destination_ip || conn.id;
}

function connectionEndpoint(conn: ConnectionInfo) {
  return `${conn.destination_ip}:${conn.destination_port}`;
}

function ConnectionSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {["active", "down", "up", "filtered"].map((key) => (
          <Card key={key} className="p-4">
            <Skeleton width="90px" height="12px" />
            <Skeleton width="120px" height="24px" className="mt-3" />
          </Card>
        ))}
      </div>
      <Card>
        <Skeleton width="220px" height="14px" />
        <div className="mt-4 space-y-2">
          {["row-a", "row-b", "row-c", "row-d"].map((key) => (
            <Skeleton key={key} height="58px" />
          ))}
        </div>
      </Card>
    </div>
  );
}

function MetaTile({ label, value, tone = "text-text" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-[10px] border border-black/70 bg-black/15 px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">{label}</p>
      <p className={`mt-1 break-words font-heading text-lg ${tone}`}>{value}</p>
    </div>
  );
}

function CloseConnectionModal({
  target,
  closing,
  onCancel,
  onConfirm,
}: {
  target: ConnectionInfo | null;
  closing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const containerRef = useModalAccessibility(!!target, onCancel);
  if (!target) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div ref={containerRef} className="w-full max-w-lg rounded-[16px] border-2 border-black bg-surface p-5 shadow-[8px_8px_0_#000] outline-none">
        <div className="mb-4 flex items-center justify-between gap-3 border-b-2 border-black/70 pb-3">
          <h3 className="font-heading text-lg uppercase tracking-wide text-text">Close Connection</h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border-2 border-black bg-black/10 p-1.5 text-text-muted transition-colors hover:bg-black/20 hover:text-text"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4">
          <DataState
            tone="danger"
            icon={<ShieldX className="h-4 w-4" />}
            title="Disconnect active flow"
            message="This terminates the selected live Mihomo connection. The client may reconnect immediately if traffic continues."
            className="shadow-none"
          />
          <div className="rounded-[12px] border-2 border-danger/40 bg-danger/10 px-3 py-3">
            <p className="break-all font-heading text-sm uppercase tracking-wide text-text">{connectionLabel(target)}</p>
            <p className="mt-1 break-all font-mono text-xs text-text-muted">{target.source_ip}:{target.source_port} → {connectionEndpoint(target)}</p>
            <p className="mt-1 break-all font-mono text-xs text-text-muted">Rule: {target.rule || "—"} / Chain: {target.chain || "—"}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <RetroBtn size="sm" variant="ghost" onClick={onCancel}>Cancel</RetroBtn>
            <RetroBtn size="sm" variant="danger" onClick={onConfirm} loading={closing}>
              Close Connection
            </RetroBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ConnectionsPage() {
  const [data, setData] = useState<ConnectionsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [networkFilter, setNetworkFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [closeTarget, setCloseTarget] = useState<ConnectionInfo | null>(null);
  const [closing, setClosing] = useState<string | null>(null);

  const loadData = useCallback(async (mode: "init" | "refresh" = "init") => {
    if (mode === "init") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    try {
      const result = await mihomoApi.getConnectionsList();
      setData(result);
      setLastLoadedAt(new Date());
      setError(null);
      if (mode === "refresh") toast.success("Connections refreshed");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load connections";
      setError(message);
      toast.error(message);
    } finally {
      if (mode === "init") setLoading(false);
      if (mode === "refresh") setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const connections = useMemo(() => data?.connections ?? [], [data]);
  const selected = connections.find((conn) => conn.id === selectedId) ?? null;

  const networkOptions = useMemo(() => {
    const values = Array.from(new Set(connections.map((conn) => conn.network).filter(Boolean))).sort();
    return ["all", ...values];
  }, [connections]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return connections.filter((c) => {
      const matchesNetwork = networkFilter === "all" || c.network === networkFilter;
      if (!matchesNetwork) return false;
      if (!q) return true;
      return [
        c.host,
        c.destination_ip,
        c.source_ip,
        c.rule,
        c.rule_payload,
        c.chain,
        ...(c.chains || []),
        c.type,
        c.network,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [connections, networkFilter, search]);

  const summary = useMemo(() => {
    const direct = connections.filter((conn) => conn.rule === "DIRECT").length;
    const rejected = connections.filter((conn) => conn.rule === "REJECT").length;
    const proxied = Math.max(0, connections.length - direct - rejected);
    const udp = connections.filter((conn) => conn.network === "udp").length;
    return { direct, rejected, proxied, udp };
  }, [connections]);

  const confirmClose = async () => {
    if (!closeTarget) return;
    setClosing(closeTarget.id);
    try {
      await mihomoApi.closeConnection(closeTarget.id);
      toast.success("Connection closed");
      setSelectedId((current) => (current === closeTarget.id ? null : current));
      setCloseTarget(null);
      await loadData("refresh");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to close connection");
    } finally {
      setClosing(null);
    }
  };

  const totalVolume = (data?.downloadTotal ?? 0) + (data?.uploadTotal ?? 0);
  const posture = error ? "Snapshot stale" : connections.length === 0 ? "Quiet line" : summary.rejected > 0 ? "Rejecting flows" : "Flows active";
  const postureTone = error ? "text-danger" : connections.length === 0 ? "text-text" : summary.rejected > 0 ? "text-warning" : "text-primary";

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-[16px] border-2 border-black bg-surface p-5 shadow-[8px_8px_0_#000]">
        <div className="absolute right-[-70px] top-[-70px] h-44 w-44 rounded-full border-2 border-black bg-primary/10" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl uppercase tracking-wide text-text">Connections</h1>
              <FreshnessPill loading={loading || refreshing} error={error} lastUpdatedAt={lastLoadedAt} stale={Boolean(error && data)} />
            </div>
            <p className="mt-2 font-mono text-xs uppercase tracking-wider text-text-muted">
              Active Mihomo flows, routing path, and disconnect controls
            </p>
            <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Connection posture</p>
                <p className={`font-heading text-4xl uppercase tracking-wide ${postureTone}`}>{posture}</p>
              </div>
              <div className="pb-1 font-mono text-xs text-text-muted">
                {connections.length} active / {summary.proxied} proxied / {summary.direct} direct / {formatBytes(totalVolume)} observed
              </div>
            </div>
          </div>
          <RetroBtn variant="ghost" size="sm" onClick={() => void loadData("refresh")} loading={refreshing}>
            <RefreshCcw className="mr-1.5 inline-block h-3.5 w-3.5" />
            Refresh
          </RetroBtn>
        </div>
      </div>

      {error && (
        <DataState
          tone="danger"
          icon={<CircleAlert className="h-4 w-4" />}
          title={data ? "Connection snapshot stale" : "Connections unavailable"}
          message={data ? `Keeping the last successful connection snapshot visible. Backend said: ${error}` : error}
          action={<RetroBtn size="sm" variant="ghost" onClick={() => void loadData("refresh")} loading={refreshing}>Retry</RetroBtn>}
        />
      )}

      {loading ? (
        <ConnectionSkeleton />
      ) : !data ? (
        <DataState
          tone="danger"
          icon={<CircleAlert className="h-4 w-4" />}
          title="No connection snapshot"
          message="Mihomo connection endpoint did not return usable data. Retry once backend is reachable."
          action={<RetroBtn size="sm" variant="ghost" onClick={() => void loadData("refresh")} loading={refreshing}>Retry</RetroBtn>}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card className="p-4">
              <p className="font-heading text-xs uppercase tracking-wide text-text-muted">Active Flows</p>
              <p className="mt-1 font-mono text-2xl text-text">{connections.length}</p>
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
              <p className="font-heading text-xs uppercase tracking-wide text-text-muted">Filtered</p>
              <p className="mt-1 font-mono text-2xl text-text">{filtered.length}</p>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
            <Card title="Connection Queue" icon={<Signal className="h-4 w-4" />} action={<Badge variant={summary.udp > 0 ? "warning" : "default"}>{summary.udp} udp</Badge>}>
              <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
                <label className="flex items-center gap-2 rounded-[12px] border-2 border-black bg-black/10 px-3 py-2">
                  <Search className="h-4 w-4 text-text-muted" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search host, IP, rule, chain, type..."
                    className="w-full bg-transparent font-mono text-sm text-text outline-none placeholder:text-text-muted"
                  />
                </label>
                <select
                  value={networkFilter}
                  onChange={(e) => setNetworkFilter(e.target.value)}
                  className="rounded-[12px] border-2 border-black bg-black/10 px-3 py-2 font-mono text-sm uppercase text-text outline-none transition focus:border-primary"
                >
                  {networkOptions.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              {filtered.length === 0 ? (
                <DataState
                  tone={connections.length === 0 ? "neutral" : "warning"}
                  icon={connections.length === 0 ? <Network className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                  title={connections.length === 0 ? "No active connections" : "No matching flows"}
                  message={connections.length === 0 ? "Mihomo reports a quiet connection table. Start proxy traffic, then refresh." : "Clear search or switch network filter to see more active flows."}
                  action={connections.length === 0 ? <RetroBtn size="sm" variant="ghost" onClick={() => void loadData("refresh")} loading={refreshing}>Refresh</RetroBtn> : undefined}
                />
              ) : (
                <div className="overflow-hidden rounded-[12px] border-2 border-black">
                  <div className="grid grid-cols-[minmax(220px,1.4fr)_90px_90px_100px_140px_110px] gap-3 border-b-2 border-black bg-black/5 px-4 py-2 font-heading text-[11px] uppercase tracking-wide text-text-muted max-lg:hidden">
                    <span>Destination</span>
                    <span>Network</span>
                    <span>Type</span>
                    <span>Rule</span>
                    <span>Traffic</span>
                    <span className="text-right">Action</span>
                  </div>
                  <div className="divide-y divide-black/10">
                    {filtered.map((conn) => {
                      const active = selected?.id === conn.id;
                      return (
                        <div
                          key={conn.id}
                          className={`grid gap-3 px-4 py-3 transition-colors lg:grid-cols-[minmax(220px,1.4fr)_90px_90px_100px_140px_110px] lg:items-center ${
                            active ? "bg-primary/10" : "bg-black/5 hover:bg-black/10"
                          }`}
                        >
                          <button type="button" onClick={() => setSelectedId(active ? null : conn.id)} className="min-w-0 text-left">
                            <p className="truncate font-heading text-sm uppercase tracking-wide text-text" title={connectionLabel(conn)}>{connectionLabel(conn)}</p>
                            <p className="mt-1 truncate font-mono text-[11px] text-text-muted" title={`${conn.source_ip}:${conn.source_port} → ${connectionEndpoint(conn)}`}>
                              {conn.source_ip}:{conn.source_port} → {connectionEndpoint(conn)}
                            </p>
                            <p className="mt-1 truncate font-mono text-[11px] text-text-muted" title={conn.chain || conn.chains?.join(" / ")}>{conn.chain || conn.chains?.join(" / ") || "no chain"}</p>
                          </button>
                          <div>{networkBadge(conn.network)}</div>
                          <p className="font-mono text-xs uppercase text-text-muted">{conn.type || "—"}</p>
                          <div>{ruleBadge(conn.rule)}</div>
                          <div className="space-y-1 font-mono text-xs">
                            <p className="flex items-center gap-1 text-primary"><ArrowDownToLine className="h-3 w-3" />{conn.download_display || formatBytes(conn.download)}</p>
                            <p className="flex items-center gap-1 text-secondary"><ArrowUpFromLine className="h-3 w-3" />{conn.upload_display || formatBytes(conn.upload)}</p>
                          </div>
                          <div className="flex justify-start lg:justify-end">
                            <RetroBtn
                              variant="ghost"
                              size="sm"
                              onClick={() => setCloseTarget(conn)}
                              loading={closing === conn.id}
                            >
                              <X className="mr-1.5 inline-block h-3.5 w-3.5" />
                              Close
                            </RetroBtn>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>

            <div className="space-y-6">
              <Card
                title="Flow Inspector"
                icon={<Shield className="h-4 w-4" />}
                action={selected ? networkBadge(selected.network) : undefined}
              >
                {!selected ? (
                  <DataState
                    title="Select a connection"
                    message="Click a row to inspect endpoints, routing decision, chain path, and close controls."
                  />
                ) : (
                  <div className="space-y-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="break-all font-heading text-xl uppercase tracking-wide text-text">{connectionLabel(selected)}</h2>
                        {ruleBadge(selected.rule)}
                      </div>
                      <p className="mt-2 break-all font-mono text-xs text-text-muted">{selected.id}</p>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <MetaTile label="Download" value={selected.download_display || formatBytes(selected.download)} tone="text-primary" />
                      <MetaTile label="Upload" value={selected.upload_display || formatBytes(selected.upload)} tone="text-secondary" />
                      <MetaTile label="Source" value={`${selected.source_ip}:${selected.source_port}`} />
                      <MetaTile label="Destination" value={connectionEndpoint(selected)} />
                    </div>

                    <div className="rounded-[12px] border-2 border-black bg-black/10 p-3">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-info" />
                        <p className="font-heading text-xs uppercase tracking-wider text-text">Routing path</p>
                      </div>
                      <p className="mt-2 break-all font-mono text-xs text-text-muted">Rule payload: {selected.rule_payload || "—"}</p>
                      <p className="mt-1 break-all font-mono text-xs text-text-muted">Chain: {selected.chains?.length ? selected.chains.join(" → ") : selected.chain || "—"}</p>
                    </div>

                    <DataState
                      tone="danger"
                      icon={<ShieldX className="h-4 w-4" />}
                      title="Close only if this flow is unwanted"
                      message="Closing disconnects the current socket. Persistent clients may reconnect through Mihomo."
                      action={
                        <RetroBtn variant="danger" size="sm" onClick={() => setCloseTarget(selected)} loading={closing === selected.id}>
                          Close Flow
                        </RetroBtn>
                      }
                      className="shadow-none"
                    />
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      )}

      <CloseConnectionModal
        target={closeTarget}
        closing={Boolean(closeTarget && closing === closeTarget.id)}
        onCancel={() => setCloseTarget(null)}
        onConfirm={() => void confirmClose()}
      />
    </div>
  );
}

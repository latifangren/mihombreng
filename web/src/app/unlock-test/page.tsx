"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RetroBtn } from "@/components/ui/retro-btn";
import { Skeleton } from "@/components/ui/skeleton";
import { DataState } from "@/components/ui/data-state";
import { unlockTestApi } from "@/services/api";
import type { UnlockTestTarget, UnlockTestResult } from "@/types";
import { RefreshCcw, Wifi } from "lucide-react";
import toast from "react-hot-toast";

type TargetResultState = {
  status?: "Yes" | "No" | "Failed";
  region?: string;
  checked_at?: string;
  message?: string;
  loading?: boolean;
};

function getFlagEmoji(countryCode?: string) {
  if (!countryCode) return "";
  const code = countryCode.toUpperCase();
  if (code.length !== 2) return "";
  const codePoints = code
    .split("")
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export default function UnlockTestPage() {
  const [targets, setTargets] = useState<UnlockTestTarget[]>([]);
  const [results, setResults] = useState<Record<string, TargetResultState>>({});
  const [loading, setLoading] = useState(true);
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "http" | "tcp" | "dns">("all");

  useEffect(() => {
    const loadTargets = async () => {
      try {
        setLoading(true);
        const data = await unlockTestApi.listUnlockTestTargets();
        setTargets(data);
        const initial: Record<string, TargetResultState> = {};
        data.forEach((t: UnlockTestTarget) => {
          initial[t.id] = { loading: false };
        });
        setResults(initial);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error("Failed to load unlock targets: " + msg);
      } finally {
        setLoading(false);
      }
    };
    loadTargets();
  }, []);

  const runAllTests = async () => {
    setIsTestingAll(true);
    setResults(prev => {
      const next = { ...prev };
      targets.forEach(t => {
        next[t.id] = { ...next[t.id], loading: true };
      });
      return next;
    });

    try {
      const resp = await unlockTestApi.runUnlockTest();
      if (Array.isArray(resp)) {
        const nextResults: Record<string, TargetResultState> = {};
        resp.forEach((item: UnlockTestResult) => {
          nextResults[item.id] = {
            status: item.status,
            region: item.region,
            checked_at: item.checked_at,
            message: item.message,
            loading: false,
          };
        });
        setResults(nextResults);
        toast.success("All tests completed successfully!");
      } else {
        toast.error("Failed to parse test results");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Error executing targets: " + msg);
      setResults(prev => {
        const next = { ...prev };
        targets.forEach(t => {
          if (next[t.id]?.loading) {
            next[t.id] = { ...next[t.id], loading: false };
          }
        });
        return next;
      });
    } finally {
      setIsTestingAll(false);
    }
  };

  const runSingleTest = async (targetId: string) => {
    setResults(prev => ({
      ...prev,
      [targetId]: { ...prev[targetId], loading: true }
    }));

    try {
      const resp = await unlockTestApi.runUnlockTest(targetId);
      if (resp && !Array.isArray(resp)) {
        setResults(prev => ({
          ...prev,
          [targetId]: {
            status: resp.status,
            region: resp.region,
            checked_at: resp.checked_at,
            message: resp.message,
            loading: false,
          }
        }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setResults(prev => ({
        ...prev,
        [targetId]: {
          status: "Failed",
          checked_at: new Date().toISOString(),
          message: msg,
          loading: false,
        }
      }));
      toast.error(`Failed to execute target test: ${targetId}`);
    }
  };

  const filteredTargets = targets.filter(t => {
    if (activeFilter === "all") return true;
    return t.type === activeFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <h1 className="font-mono text-2xl font-bold uppercase tracking-tight">Unlock & Connectivity Test</h1>
          <p className="font-mono text-xs text-text-muted">Route connectivity and streaming unlock tests through Mihomo proxy.</p>
        </div>
        {!loading && targets.length > 0 && (
          <RetroBtn
            onClick={runAllTests}
            disabled={isTestingAll}
            className="flex items-center gap-2 bg-primary text-black"
          >
            <Wifi className={`h-4 w-4 ${isTestingAll ? "animate-pulse" : ""}`} />
            TEST ALL
          </RetroBtn>
        )}
      </div>

      <div className="flex gap-2">
        {(["all", "http", "tcp", "dns"] as const).map(filter => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            className={`border px-3 py-1 font-mono text-xs uppercase transition-all ${
              activeFilter === filter
                ? "border-black bg-black text-white hover:bg-neutral-800"
                : "border-border bg-surface text-text-muted hover:border-black hover:text-black"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {loading ? (
        <TargetsSkeleton />
      ) : targets.length === 0 ? (
        <DataState
          title="No connectivity targets configured"
          message="Define targets in defaults/mihombreng.yaml under unlock_test.targets."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTargets.map(target => {
            const res = results[target.id] || {};
            const flag = res.region ? getFlagEmoji(res.region) : "";
            
            return (
              <Card key={target.id} className="relative flex flex-col justify-between border-2 border-black p-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-mono text-sm font-bold leading-tight">{target.name}</h3>
                      <p className="mt-1 font-mono text-[10px] break-all text-text-muted">
                        {target.type === "http" ? target.url : target.host}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => runSingleTest(target.id)}
                      disabled={res.loading || isTestingAll}
                      className="rounded border border-black bg-surface p-1 shadow-[1px_1px_0px_0px_#000] hover:bg-surface-hover hover:translate-x-[0.5px] hover:translate-y-[0.5px] hover:shadow-none disabled:opacity-50 transition-all"
                    >
                      <RefreshCcw className={`h-4 w-4 ${res.loading ? "animate-spin" : ""}`} />
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="info">{target.type}</Badge>

                    {res.loading ? (
                      <Badge variant="warning" className="animate-pulse">PROBING...</Badge>
                    ) : res.status === "Yes" ? (
                      <Badge variant="success" className="font-bold">
                        Yes {res.region && `[${res.region}]`} {flag}
                      </Badge>
                    ) : res.status === "No" ? (
                      <Badge variant="danger" className="font-bold">No</Badge>
                    ) : res.status === "Failed" ? (
                      <Badge variant="danger" className="font-bold">Failed</Badge>
                    ) : (
                      <Badge variant="default" className="text-neutral-400">Not Run</Badge>
                    )}
                  </div>
                </div>

                {res.checked_at && (
                  <div className="mt-4 border-t border-dashed border-border pt-2 flex flex-col gap-1 text-[10px] font-mono text-text-muted">
                    <div className="flex justify-between">
                      <span>Tested:</span>
                      <span>{new Date(res.checked_at).toLocaleTimeString()}</span>
                    </div>
                    {res.message && (
                      <div className="flex justify-between text-neutral-400">
                        <span>Details:</span>
                        <span className="truncate max-w-[150px]">{res.message}</span>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TargetsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <Card key={i} className="border-2 border-black p-4 space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <Skeleton width="100px" height="16px" />
              <Skeleton width="160px" height="10px" />
            </div>
            <Skeleton width="24px" height="24px" />
          </div>
          <Skeleton width="50px" height="18px" />
        </Card>
      ))}
    </div>
  );
}

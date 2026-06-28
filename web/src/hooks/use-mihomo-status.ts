import { useState, useEffect, useCallback } from "react";
import { mihomoApi } from "@/services/api";
import type { MihomoStatus } from "@/types";

const POLL_INTERVAL = 5000;

export function useMihomoStatus() {
  const [status, setStatus] = useState<MihomoStatus>({ running: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const [s, version] = await Promise.all([
        mihomoApi.getStatus(),
        mihomoApi.getCoreVersion().catch(() => ""),
      ]);
      setStatus({ ...s, version: version || s.version });
      setError(null);
    } catch (err) {
      setStatus({ running: false });
      setError(err instanceof Error ? err.message : "Failed to fetch status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetch]);

  return { status, loading, error, refetch: fetch };
}

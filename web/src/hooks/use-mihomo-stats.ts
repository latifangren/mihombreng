import { useState, useEffect, useCallback } from "react";
import { mihomoApi } from "@/services/api";

const POLL_INTERVAL = 3000;

interface Stats {
  memory: { inuse: number; oslimit: number };
  traffic: { up: number; down: number };
  connections: number;
}

export function useMihomoStats() {
  const [stats, setStats] = useState<Stats>({
    memory: { inuse: 0, oslimit: 0 },
    traffic: { up: 0, down: 0 },
    connections: 0,
  });
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    try {
      const [memory, traffic, connections] = await Promise.all([
        mihomoApi.getMemory(),
        mihomoApi.getTraffic(),
        mihomoApi.getConnections(),
      ]);
      setStats({ memory, traffic, connections: connections.total });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch stats");
    }
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetch]);

  return { stats, error };
}

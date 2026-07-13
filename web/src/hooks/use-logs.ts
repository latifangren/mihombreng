import { useState, useEffect, useRef, useCallback } from "react";
import { createLogStream } from "@/services/ws";
import type { MihomoLog } from "@/types";

const MAX_LOGS = 500;
const RECONNECT_BASE_MS = 3000;
const RECONNECT_MAX_MS = 30000;

export function useLogs(endpoint: string, clearEndpoint = "/api/v1/mihomo/logs") {
  const [logs, setLogs] = useState<MihomoLog[]>([]);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [connectionState, setConnectionState] = useState<"connecting" | "connected" | "reconnecting" | "offline">("connecting");
  const [lastStatus, setLastStatus] = useState<MihomoLog | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  const pausedRef = useRef(false);
  const wsRef = useRef<{ close: () => void } | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(RECONNECT_BASE_MS);
  const mountedRef = useRef(true);
  const manualCloseRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const bufferRef = useRef<MihomoLog[]>([]);

  // Flush buffer to state every 150ms
  useEffect(() => {
    const timer = setInterval(() => {
      if (bufferRef.current.length === 0) return;
      const newLines = bufferRef.current;
      bufferRef.current = [];
      setLogs((prev) => {
        const next = [...prev, ...newLines];
        return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next;
      });
    }, 150);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    setConnected(false);
    setConnectionState(reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting");

    wsRef.current = createLogStream(
      endpoint,
      (line) => {
        if (line.kind === "status") {
          setLastStatus(line);
          if (line.status === "connected") {
            setConnected(true);
            setConnectionState("connected");
            reconnectAttemptRef.current = 0;
            setReconnectAttempt(0);
            backoffRef.current = RECONNECT_BASE_MS;
          } else if (line.status === "connecting") {
            setConnected(false);
            setConnectionState(reconnectAttemptRef.current > 0 ? "reconnecting" : "connecting");
          } else if (line.status === "warning") {
            setConnected(false);
            setConnectionState("reconnecting");
          } else if (line.status === "error") {
            setConnected(false);
            setConnectionState("offline");
          }
          return;
        }

        if (pausedRef.current) return;
        bufferRef.current.push(line);
        if (bufferRef.current.length > MAX_LOGS) {
          bufferRef.current = bufferRef.current.slice(-MAX_LOGS);
        }
      },
      () => {},
      () => {
        setConnected(true);
        setConnectionState("connected");
        reconnectAttemptRef.current = 0;
        setReconnectAttempt(0);
        backoffRef.current = RECONNECT_BASE_MS;
      },
      () => {
        setConnected(false);
        if (mountedRef.current && !manualCloseRef.current) {
          setConnectionState("reconnecting");
          reconnectAttemptRef.current += 1;
          setReconnectAttempt(reconnectAttemptRef.current);
          reconnectRef.current = setTimeout(() => {
            connect();
          }, backoffRef.current);
          backoffRef.current = Math.min(backoffRef.current * 2, RECONNECT_MAX_MS);
        } else {
          setConnectionState("offline");
        }
      }
    );
  }, [endpoint]);

  useEffect(() => {
    mountedRef.current = true;
    manualCloseRef.current = false;
    bufferRef.current = [];
    setLogs([]);
    setConnected(false);
    setConnectionState("connecting");
    setLastStatus(null);
    reconnectAttemptRef.current = 0;
    setReconnectAttempt(0);

    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    backoffRef.current = RECONNECT_BASE_MS;

    connect();

    return () => {
      mountedRef.current = false;
      manualCloseRef.current = true;
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      wsRef.current?.close();
    };
  }, [connect]);

  const clear = useCallback(async () => {
    try {
      await fetch(clearEndpoint, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to clear logs on server:", err);
    }
    bufferRef.current = [];
    setLogs([]);
  }, [clearEndpoint]);

  const togglePause = useCallback(() => {
    setPaused((p) => {
      const next = !p;
      pausedRef.current = next;
      return next;
    });
  }, []);

  return { logs, connected, paused, clear, togglePause, connectionState, lastStatus, reconnectAttempt };
}

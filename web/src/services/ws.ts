import type { MihomoLog } from "@/types";

type LogCallback = (line: MihomoLog) => void;

function isLogLine(value: unknown): value is MihomoLog {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as MihomoLog).kind === "string" &&
      typeof (value as MihomoLog).source === "string" &&
      typeof (value as MihomoLog).level === "string" &&
      typeof (value as MihomoLog).message === "string" &&
      typeof (value as MihomoLog).timestamp === "string"
  );
}

function fallbackLog(raw: string, level: string, message: string, source = "mihomo"): MihomoLog {
  return {
    id: `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: "log",
    source,
    level,
    message,
    timestamp: new Date().toISOString(),
    raw,
  };
}

function parseLogLine(raw: string): MihomoLog | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("ERROR:")) {
    return fallbackLog(trimmed, "error", trimmed);
  }

  const levelMatch = trimmed.match(/\blevel=("([^"]+)"|'([^']+)'|(\S+))/);
  const messageMatch = trimmed.match(/\bmsg=("([^"]+)"|'([^']+)'|(.*?))(?:\s+\w+=|$)/);
  const timeMatch = trimmed.match(/\btime=("([^"]+)"|'([^']+)'|(\S+))/);

  const level = levelMatch?.[2] ?? levelMatch?.[3] ?? levelMatch?.[4] ?? "info";
  const message = (messageMatch?.[2] ?? messageMatch?.[3] ?? messageMatch?.[4] ?? trimmed).trim();
  const timestamp = timeMatch?.[2] ?? timeMatch?.[3] ?? timeMatch?.[4] ?? new Date().toISOString();

  if (!message) {
    return null;
  }

  return {
    id: `mihomo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: "log",
    source: "mihomo",
    level,
    message,
    timestamp,
    raw: trimmed,
  };
}

export function createLogStream(
  endpoint: string,
  onMessage: LogCallback,
  onError?: (err: Event) => void,
  onOpen?: () => void,
  onClose?: () => void
): { close: () => void } {
  const token = localStorage.getItem("mihombreng_auth_token");
  let finalEndpoint = endpoint;
  if (token) {
    const separator = endpoint.includes("?") ? "&" : "?";
    finalEndpoint = `${endpoint}${separator}token=${encodeURIComponent(token)}`;
  }

  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  const url = `${proto}//${host}${finalEndpoint}`;
  
  let ws: WebSocket;
  if (token) {
    ws = new WebSocket(url, [token]); // Also send token as subprotocol in case of proxy issues
  } else {
    ws = new WebSocket(url);
  }

  ws.onopen = () => onOpen?.();

  ws.onmessage = (e) => {
    const raw = typeof e.data === "string" ? e.data : String(e.data ?? "");

    try {
      const data: unknown = JSON.parse(raw);
      if (isLogLine(data) && data.message.trim()) {
        onMessage(data);
        return;
      }
    } catch {
      // Fall back to raw log line parsing.
    }

    const parsed = parseLogLine(raw);
    if (parsed) {
      onMessage(parsed);
    }
  };

  ws.onerror = (e) => onError?.(e);
  ws.onclose = () => onClose?.();

  return {
    close: () => ws.close(),
  };
}

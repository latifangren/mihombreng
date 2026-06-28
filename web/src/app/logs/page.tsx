import { useMemo, useState } from "react";
import { Terminal } from "@/components/terminal/terminal";
import { LogLine } from "@/components/terminal/log-line";
import { LogFilter } from "@/components/terminal/log-filter";
import { Card } from "@/components/ui/card";
import { DataState } from "@/components/ui/data-state";
import { RetroBtn } from "@/components/ui/retro-btn";
import { useLogs } from "@/hooks/use-logs";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Clipboard,
  Download,
  Info,
  Pause,
  Play,
  Search,
  TerminalSquare,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

type Level = "all" | "info" | "warning" | "error" | "debug";
type SortOrder = "oldest" | "newest";

const connectionText: Record<string, string> = {
  connecting: "CONNECTING",
  connected: "LIVE",
  reconnecting: "RECONNECTING",
  offline: "OFFLINE",
};

const connectionDot: Record<string, string> = {
  connecting: "bg-warning animate-pulse",
  connected: "bg-primary",
  reconnecting: "bg-warning animate-pulse",
  offline: "bg-danger",
};

const connectionTone: Record<string, string> = {
  connecting: "text-warning",
  connected: "text-primary",
  reconnecting: "text-warning",
  offline: "text-danger",
};

const connectionSummary: Record<string, string> = {
  connecting: "Opening socket",
  connected: "Live stream active",
  reconnecting: "Retrying stream",
  offline: "Stream disconnected",
};

function formatLogLines(logs: { message: string; timestamp: string; level: string; source?: string }[]) {
  return logs.map((l) => `${l.timestamp} [${l.level}]${l.source ? ` [${l.source}]` : ""} ${l.message}`).join("\n");
}

function escapeCSVField(field: string): string {
  if (/[",\n\r]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function convertLogsToCSV(logs: { message: string; timestamp: string; level: string; source?: string }[]) {
  const headers = ["Timestamp", "Level", "Source", "Message"].join(",");
  const rows = logs.map((l) => [
    escapeCSVField(l.timestamp),
    escapeCSVField(l.level),
    escapeCSVField(l.source || ""),
    escapeCSVField(l.message)
  ].join(","));
  return [headers, ...rows].join("\n");
}

function convertLogsToJSON(logs: { message: string; timestamp: string; level: string; source?: string }[]) {
  return JSON.stringify(logs, null, 2);
}

function StreamStatusCard({
  connectionState,
  reconnectAttempt,
  logCount,
  lastStatus,
}: {
  connectionState: string;
  reconnectAttempt: number;
  logCount: number;
  lastStatus: { message: string; source?: string } | null;
}) {
  const isOffline = connectionState === "offline";

  return (
    <Card title="Stream Status" icon={<Wifi className="h-4 w-4" />}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${connectionDot[connectionState] || "bg-text-muted"}`} />
          <div>
            <p className={`font-heading text-sm uppercase tracking-wide ${connectionTone[connectionState] || "text-text"}`}>
              {connectionText[connectionState] || connectionState.toUpperCase()}
            </p>
            {connectionState === "connecting" && (
              <p className="font-mono text-xs text-warning">Opening log socket...</p>
            )}
            {connectionState === "reconnecting" && (
              <p className="font-mono text-xs text-warning">Retrying without clearing buffer...</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[8px] border border-black/70 bg-black/15 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Entries</p>
            <p className="mt-1 font-heading text-xl text-text">{logCount}</p>
          </div>
          <div className="rounded-[8px] border border-black/70 bg-black/15 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Reconnects</p>
            <p className="mt-1 font-heading text-xl text-text">{reconnectAttempt}</p>
          </div>
        </div>
        {lastStatus && (
          <div className="rounded-[8px] border border-black/70 bg-black/15 px-3 py-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Latest status</p>
            <p className="mt-1 break-words font-mono text-xs text-text-muted">{lastStatus.message}</p>
          </div>
        )}
        {isOffline && (
          <div className="rounded-[8px] border-2 border-danger/40 bg-danger/10 px-3 py-2">
            <div className="flex items-start gap-2">
              <WifiOff className="mt-0.5 h-3.5 w-3.5 text-danger" />
              <p className="font-mono text-xs text-danger">Stream disconnected. Check backend connectivity.</p>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

export default function LogsPage() {
  const { logs, paused, clear, togglePause, connectionState, lastStatus, reconnectAttempt } = useLogs("/api/v1/mihomo/logs");
  const [filter, setFilter] = useState<Level>("all");
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [autoscroll, setAutoscroll] = useState(true);
  const [showControls, setShowControls] = useState(true);

  const filteredLogs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return logs.filter((log) => {
      if (filter !== "all" && log.level !== filter) return false;
      if (!normalizedQuery) return true;
      return (
        log.message.toLowerCase().includes(normalizedQuery) ||
        log.source.toLowerCase().includes(normalizedQuery) ||
        (log.raw || "").toLowerCase().includes(normalizedQuery)
      );
    });
  }, [logs, filter, query]);

  const displayLogs = useMemo(
    () => (sortOrder === "newest" ? [...filteredLogs].reverse() : filteredLogs),
    [filteredLogs, sortOrder]
  );

  const handleCopy = async () => {
    const text = formatLogLines(displayLogs);
    await navigator.clipboard.writeText(text);
    toast.success(`${displayLogs.length} log lines copied`);
  };

  const handleDownload = () => {
    const text = formatLogLines(displayLogs);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mihombreng-logs-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Log file downloaded");
  };

  const handleDownloadCSV = () => {
    const text = convertLogsToCSV(displayLogs);
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mihombreng-logs-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV logs downloaded");
  };

  const handleDownloadJSON = () => {
    const text = convertLogsToJSON(displayLogs);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mihombreng-logs-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("JSON logs downloaded");
  };

  const handleClear = () => {
    void clear();
    toast.success("Log buffer cleared");
  };

  const isTransient = connectionState === "connecting" || connectionState === "reconnecting";
  const isOffline = connectionState === "offline";
  const posture = connectionState === "connected" ? "Stream live" : connectionState === "connecting" ? "Opening stream" : isOffline ? "Stream down" : "Reconnecting";
  const postureTone = connectionState === "connected" ? "text-primary" : isTransient ? "text-warning" : "text-danger";
  const emptyLogTitle = logs.length > 0
    ? "No matching lines"
    : connectionState === "connected"
      ? "Stream live, no entries yet"
      : connectionState === "connecting"
        ? "Opening log stream"
        : connectionState === "reconnecting"
          ? "Reconnecting log stream"
          : "Log stream offline";
  const emptyLogMessage = logs.length > 0
    ? "Adjust search or filter to see more log lines."
    : connectionState === "connected"
      ? "Socket is live. New Mihomo logs will appear as soon as the core emits them."
      : connectionState === "connecting"
        ? "Opening the WebSocket now. No log entries have arrived yet."
        : connectionState === "reconnecting"
          ? "Retrying the WebSocket connection. Buffered logs will stay here once entries exist."
          : "The WebSocket is disconnected. Check backend connectivity or Mihomo runtime state.";
  const emptyLogTone = logs.length > 0 ? "neutral" : isOffline ? "danger" : isTransient ? "warning" : "neutral";

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-[16px] border-2 border-black bg-surface p-5 shadow-[8px_8px_0_#000]">
        <div className="absolute right-[-60px] top-[-80px] h-44 w-44 rounded-full border-2 border-black bg-primary/10" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-2xl uppercase tracking-wide text-text">Logs</h1>
              <span
                className="inline-flex items-center gap-2 rounded-full border-2 border-black bg-background px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-text-muted"
                title={lastStatus?.message}
              >
                <span className={`h-2 w-2 rounded-full ${connectionDot[connectionState] || "bg-text-muted"}`} />
                {connectionSummary[connectionState] || connectionState}
              </span>
            </div>
            <p className="mt-2 font-mono text-xs uppercase tracking-wider text-text-muted">
              Live Mihomo log stream with search, level filter, and export
            </p>
            <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-text-muted">Stream posture</p>
                <p className={`font-heading text-4xl uppercase tracking-wide ${postureTone}`}>{posture}</p>
              </div>
              <div className="pb-1 font-mono text-xs text-text-muted">
                {filteredLogs.length} visible / {logs.length} buffered / {paused ? "paused" : "streaming"}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <RetroBtn variant="ghost" size="sm" onClick={togglePause}>
              {paused ? (
                <><Play className="mr-1.5 inline-block h-3.5 w-3.5" /> Resume</>
              ) : (
                <><Pause className="mr-1.5 inline-block h-3.5 w-3.5" /> Pause</>
              )}
            </RetroBtn>
            <RetroBtn variant="ghost" size="sm" onClick={handleCopy} title="Copy filtered logs to clipboard">
              <Clipboard className="mr-1.5 inline-block h-3.5 w-3.5" />
              Copy
            </RetroBtn>
            <RetroBtn variant="ghost" size="sm" onClick={handleDownload} title="Export filtered logs as raw TXT file">
              <Download className="mr-1.5 inline-block h-3.5 w-3.5" />
              Export TXT
            </RetroBtn>
            <RetroBtn variant="ghost" size="sm" onClick={handleDownloadCSV} title="Export filtered logs as CSV spreadsheet">
              <Download className="mr-1.5 inline-block h-3.5 w-3.5" />
              Export CSV
            </RetroBtn>
            <RetroBtn variant="ghost" size="sm" onClick={handleDownloadJSON} title="Export filtered logs as structured JSON">
              <Download className="mr-1.5 inline-block h-3.5 w-3.5" />
              Export JSON
            </RetroBtn>
          </div>
        </div>
      </div>

      {isOffline && (
        <DataState
          tone="danger"
          title="Stream disconnected"
          message="The log WebSocket is no longer connected. Backend may be unreachable or Mihomo may not be running."
        />
      )}

      {isTransient && (
        <DataState
          tone="warning"
          title="Reconnecting to log stream"
          message={`Attempt ${reconnectAttempt} in progress. Buffered logs remain visible during reconnection.`}
        />
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
        {/* Log stream */}
        <Card
          title="Log Stream"
          icon={<TerminalSquare className="h-4 w-4" />}
          action={
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-black/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                {filteredLogs.length}
              </span>
              <button
                type="button"
                onClick={() => setShowControls((p) => !p)}
                className="font-mono text-[10px] uppercase tracking-wider text-text-muted hover:text-text"
              >
                {showControls ? "Hide" : "Show"} Controls
              </button>
            </div>
          }
        >
          {showControls && (
            <div className="mb-4 space-y-3 rounded-[12px] border-2 border-black bg-black/5 p-3">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <label className="flex items-center gap-2 rounded-[10px] border-2 border-black bg-black/10 px-3 py-2">
                  <Search className="h-4 w-4 text-text-muted" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search log lines..."
                    className="w-full bg-transparent font-mono text-sm text-text outline-none placeholder:text-text-muted"
                  />
                  {query && (
                    <button type="button" onClick={() => setQuery("")} className="text-text-muted hover:text-text">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </label>
                <div className="flex flex-wrap gap-2">
                  <RetroBtn size="sm" variant={autoscroll ? "primary" : "ghost"} onClick={() => setAutoscroll((p) => !p)}>
                    {autoscroll ? <Play className="mr-1 inline-block h-3 w-3" /> : <Pause className="mr-1 inline-block h-3 w-3" />}
                    Scroll
                  </RetroBtn>
                  <RetroBtn size="sm" variant="ghost" onClick={() => setSortOrder((o) => (o === "oldest" ? "newest" : "oldest"))}>
                    {sortOrder === "oldest" ? <ArrowDownAZ className="mr-1 inline-block h-3 w-3" /> : <ArrowUpAZ className="mr-1 inline-block h-3 w-3" />}
                    {sortOrder === "oldest" ? "Oldest" : "Newest"}
                  </RetroBtn>
                  <RetroBtn size="sm" variant="ghost" onClick={handleClear}>
                    <Trash2 className="mr-1 inline-block h-3 w-3" />
                    Clear
                  </RetroBtn>
                </div>
              </div>
              <LogFilter active={filter} onChange={setFilter} />
            </div>
          )}

          <Terminal className="h-[60vh] w-full" autoscroll={autoscroll && sortOrder === "oldest"}>
            {displayLogs.length === 0 ? (
              <div className="flex h-full items-center justify-center p-6">
                <DataState
                  tone={emptyLogTone}
                  icon={<TerminalSquare className="h-4 w-4" />}
                  title={emptyLogTitle}
                  message={emptyLogMessage}
                  className="w-full max-w-md"
                />
              </div>
            ) : (
              displayLogs.map((log, i) => (
                <LogLine
                  key={log.id || `${i}-${log.timestamp}`}
                  level={log.level}
                  message={log.message}
                  timestamp={log.timestamp}
                  source={log.source}
                />
              ))
            )}
          </Terminal>
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          <StreamStatusCard
            connectionState={connectionState}
            reconnectAttempt={reconnectAttempt}
            logCount={logs.length}
            lastStatus={lastStatus}
          />

          <div className="rounded-[12px] border-2 border-black bg-surface p-4">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 text-info" />
              <div>
                <p className="font-heading text-xs uppercase tracking-wider text-text">Operator tips</p>
                <ul className="mt-2 space-y-1 font-mono text-xs text-text-muted">
                  <li>Pause freezes the buffer for inspection without disconnecting.</li>
                  <li>Export downloads the filtered view as a timestamped .txt file.</li>
                  <li>Newest-first shows the most recent entries at the top.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

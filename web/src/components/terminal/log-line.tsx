import { cn } from "@/utils/cn";

interface LogLineProps {
  level: string;
  message: string;
  timestamp: string;
  source?: string;
}

const levelStyles: Record<string, string> = {
  info: "text-primary",
  warning: "text-warning",
  warn: "text-warning",
  error: "text-danger",
  debug: "text-text-muted",
};

export function LogLine({ level, message, timestamp, source }: LogLineProps) {
  return (
    <div className="flex gap-3 font-mono text-xs leading-5">
      <span className="shrink-0 text-text-muted">{timestamp}</span>
      <span className={cn("shrink-0 uppercase", levelStyles[level] || "text-text")}>
        [{level}]
      </span>
      {source && <span className="shrink-0 text-text-muted">[{source}]</span>}
      <span className="text-text">{message}</span>
    </div>
  );
}

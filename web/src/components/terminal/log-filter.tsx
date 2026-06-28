import { cn } from "@/utils/cn";

export type LogLevel = "all" | "info" | "warning" | "error" | "debug";

interface LogFilterProps {
  active: LogLevel;
  onChange: (level: LogLevel) => void;
}

const levels: { key: LogLevel; label: string; color: string; activeColor: string }[] = [
  { key: "all", label: "All", color: "text-text-muted hover:text-text", activeColor: "bg-text text-background" },
  { key: "info", label: "Info", color: "text-text-muted hover:text-info", activeColor: "bg-info text-white" },
  { key: "warning", label: "Warn", color: "text-text-muted hover:text-warning", activeColor: "bg-warning text-black" },
  { key: "error", label: "Error", color: "text-text-muted hover:text-danger", activeColor: "bg-danger text-white" },
  { key: "debug", label: "Debug", color: "text-text-muted hover:text-text", activeColor: "bg-surface text-text" },
];

export function LogFilter({ active, onChange }: LogFilterProps) {
  return (
    <div className="flex overflow-hidden rounded-[8px] border-2 border-black">
      {levels.map((lvl) => (
        <button
          key={lvl.key}
          type="button"
          onClick={() => onChange(lvl.key)}
          className={cn(
            "px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors",
            "border-r-2 border-black last:border-r-0",
            active === lvl.key ? lvl.activeColor : lvl.color
          )}
        >
          {lvl.label}
        </button>
      ))}
    </div>
  );
}

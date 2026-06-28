import { cn } from "@/utils/cn";
import type { ReactNode } from "react";

interface StatsRowProps {
  items: { label: string; value: string; icon?: ReactNode }[];
  className?: string;
}

export function StatsRow({ items, className }: StatsRowProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border-2 border-black bg-border md:grid-cols-4",
        className
      )}
    >
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3 bg-surface p-4">
          {item.icon && <span className="shrink-0 text-text-muted">{item.icon}</span>}
          <div className="min-w-0">
            <div className="font-mono text-[10px] uppercase tracking-wider text-text-muted">{item.label}</div>
            <div className="truncate font-heading text-lg text-text">{item.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

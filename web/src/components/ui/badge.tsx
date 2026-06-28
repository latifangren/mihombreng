import { cn } from "@/utils/cn";
import type { ReactNode } from "react";

type BadgeVariant = "success" | "warning" | "danger" | "info" | "default";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const vMap: Record<BadgeVariant, string> = {
  success: "bg-primary/20 text-primary border-primary/30",
  warning: "bg-warning/20 text-warning border-warning/30",
  danger: "bg-danger/20 text-danger border-danger/30",
  info: "bg-info/20 text-info border-info/30",
  default: "bg-surface-hover text-text-muted border-border",
};

export function Badge({ variant = "default", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium uppercase",
        vMap[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

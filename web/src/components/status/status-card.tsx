import { Card } from "@/components/ui/card";
import { cn } from "@/utils/cn";
import type { ReactNode } from "react";

interface StatusCardProps {
  label: string;
  value: string | ReactNode;
  icon?: ReactNode;
  variant?: "success" | "warning" | "danger" | "info";
  className?: string;
}

const accentMap = {
  success: "border-l-primary",
  warning: "border-l-warning",
  danger: "border-l-danger",
  info: "border-l-info",
};

const dotMap = {
  success: "bg-primary",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

export function StatusCard({ label, value, icon, variant = "info", className }: StatusCardProps) {
  return (
    <Card className={cn("border-l-4", accentMap[variant], className)}>
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <span className={cn("inline-block h-1.5 w-1.5 rounded-full", dotMap[variant])} />
            <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted">{label}</span>
          </div>
          <div className="font-heading text-xl text-text">{value}</div>
        </div>
        {icon && <span className="text-text-muted">{icon}</span>}
      </div>
    </Card>
  );
}

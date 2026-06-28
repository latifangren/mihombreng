import type { TunnelMode } from "@/components/layout/topbar";
import { cn } from "@/utils/cn";

interface TunnelIndicatorProps {
  mode?: TunnelMode;
  running?: boolean;
  size?: "sm" | "md";
}

const modeConfig: Record<TunnelMode, { label: string; color: string; dot: string }> = {
  tun: { label: "TUN", color: "border-primary text-primary", dot: "bg-primary" },
  tproxy: { label: "TPROXY", color: "border-info text-info", dot: "bg-info" },
  redirect: { label: "REDIRECT", color: "border-warning text-warning", dot: "bg-warning" },
  off: { label: "OFF", color: "border-danger text-danger", dot: "bg-danger" },
};

const sizeMap = {
  sm: { text: "text-[9px]", py: "py-0.5", px: "px-1.5", dot: "h-1.5 w-1.5" },
  md: { text: "text-[10px]", py: "py-1", px: "px-2", dot: "h-2 w-2" },
};

export function TunnelIndicator({
  mode = "off",
  running = false,
  size = "sm",
}: TunnelIndicatorProps) {
  const effective = running ? mode : "off";
  const cfg = modeConfig[effective];
  const s = sizeMap[size];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[6px] border-2 font-mono uppercase tracking-wider",
        cfg.color,
        s.py,
        s.px,
        s.text
      )}
    >
      <span className={cn("inline-block rounded-full", cfg.dot, s.dot)} />
      {cfg.label}
    </div>
  );
}

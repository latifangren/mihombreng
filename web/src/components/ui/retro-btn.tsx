import { cn } from "@/utils/cn";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "danger" | "warning" | "ghost";
type Size = "sm" | "md" | "lg";

interface RetroBtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

const variantMap: Record<Variant, { bg: string; middle: string; text: string }> = {
  primary: { bg: "bg-primary", middle: "bg-primary-active", text: "text-black" },
  danger: { bg: "bg-danger", middle: "bg-danger-hover", text: "text-white" },
  warning: { bg: "bg-warning", middle: "bg-[#d99a1f]", text: "text-black" },
  ghost: { bg: "bg-transparent border-2 border-border text-text", middle: "bg-border", text: "text-text" },
};

const sizeMap: Record<Size, { px: string; py: string; text: string; shadowY: string; pressedY: string; shadowDepth: string }> = {
  sm: { px: "px-4", py: "py-1.5", text: "text-xs", shadowY: "translate-y-[3px]", pressedY: "translate-y-[3px]", shadowDepth: "0 3px 0 #000, 0 4px 0 #000" },
  md: { px: "px-6", py: "py-2.5", text: "text-sm", shadowY: "translate-y-[5px]", pressedY: "translate-y-[5px]", shadowDepth: "0 5px 0 #000, 0 7px 0 #000" },
  lg: { px: "px-8", py: "py-3", text: "text-base", shadowY: "translate-y-[6px]", pressedY: "translate-y-[6px]", shadowDepth: "0 6px 0 #000, 0 8px 0 #000" },
};

export function RetroBtn({
  variant = "primary",
  size = "md",
  className,
  disabled,
  loading,
  children,
  ...props
}: RetroBtnProps) {
  const v = variantMap[variant];
  const s = sizeMap[size];

  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "group relative block w-max cursor-pointer outline-none",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    >
      {/* Shadow layer — Tailwind shadow-[...] */}
      <span
        className={cn("absolute inset-0 rounded-[12px] bg-black", s.shadowY)}
        style={{ boxShadow: s.shadowDepth }}
      />
      {/* Middle offset layer */}
      <span
        className={cn(
          "absolute inset-0 rounded-[12px] transition-all duration-100",
          v.middle,
          s.shadowY,
        )}
        style={{ boxShadow: s.shadowDepth }}
      />
      {/* Face layer */}
      <span
        className={cn(
          "relative block rounded-[12px] border-2 border-black font-heading uppercase tracking-wider",
          "transition-all duration-100",
          v.bg, v.text, s.px, s.py, s.text,
          "group-hover:-translate-y-0.5",
          "group-active:translate-y-[4px] group-active:shadow-none",
          "disabled:translate-y-0 disabled:shadow-none",
        )}
      >
        {loading ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          children
        )}
      </span>
    </button>
  );
}

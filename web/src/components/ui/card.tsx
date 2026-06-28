import { cn } from "@/utils/cn";
import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}

export function Card({ title, icon, action, children, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[12px] border-2 border-black bg-surface p-6",
        className
      )}
      {...props}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon && <span className="text-text-muted">{icon}</span>}
            {title && <h3 className="font-body text-xs font-semibold uppercase tracking-wider text-text">{title}</h3>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

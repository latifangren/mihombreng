import { useEffect } from "react";
import type { ReactNode, RefObject, UIEventHandler } from "react";

interface TerminalProps {
  title?: string;
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
  viewportRef?: RefObject<HTMLDivElement | null>;
  onViewportScroll?: UIEventHandler<HTMLDivElement>;
  autoscroll?: boolean;
  scrollSignal?: number;
}

export function Terminal({ title, children, className, viewportClassName, viewportRef, onViewportScroll, autoscroll = false, scrollSignal = 0 }: TerminalProps) {
  useEffect(() => {
    void scrollSignal;
    if (!autoscroll || !viewportRef?.current) return;
    const el = viewportRef.current;
    el.scrollTop = el.scrollHeight;
  }, [autoscroll, viewportRef, scrollSignal]);

  return (
    <div className={`rounded-[12px] border-2 border-black bg-[#0a0a0a] ${className || ""}`}>
      <div className="flex items-center gap-2 border-b border-[#1a1a1a] px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-danger" />
        <span className="h-3 w-3 rounded-full bg-warning" />
        <span className="h-3 w-3 rounded-full bg-primary" />
        {title && (
          <span className="ml-3 font-mono text-[11px] text-text-muted">{title}</span>
        )}
      </div>
      <div className="p-4 font-mono text-sm">
        <div ref={viewportRef} onScroll={onViewportScroll} className={viewportClassName}>
          {children}
        </div>
      </div>
    </div>
  );
}

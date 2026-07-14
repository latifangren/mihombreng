import { useEffect, useRef } from "react";
import type { ReactNode, RefObject, UIEventHandler } from "react";

interface TerminalProps {
  title?: string;
  children: ReactNode;
  className?: string; // e.g. "h-[60vh] w-full"
  viewportClassName?: string;
  viewportRef?: RefObject<HTMLDivElement | null>;
  onViewportScroll?: UIEventHandler<HTMLDivElement>;
  autoscroll?: boolean;
  scrollSignal?: number;
}

export function Terminal({
  title,
  children,
  className,
  viewportClassName,
  viewportRef,
  onViewportScroll,
  autoscroll = false,
  scrollSignal = 0,
}: TerminalProps) {
  const fallbackRef = useRef<HTMLDivElement | null>(null);
  const activeRef = viewportRef || fallbackRef;

  useEffect(() => {
    void scrollSignal;
    void children;
    if (!autoscroll || !activeRef.current) return;
    const el = activeRef.current;
    // Scroll to the bottom
    el.scrollTop = el.scrollHeight;
  }, [autoscroll, activeRef, scrollSignal, children]);

  return (
    <div className={`flex flex-col rounded-[12px] border-2 border-black bg-[#0a0a0a] overflow-hidden ${className || ""}`}>
      <div className="flex shrink-0 items-center gap-2 border-b border-[#1a1a1a] px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-danger" />
        <span className="h-3 w-3 rounded-full bg-warning" />
        <span className="h-3 w-3 rounded-full bg-primary" />
        {title && (
          <span className="ml-3 font-mono text-[11px] text-text-muted">{title}</span>
        )}
      </div>
      <div className="flex-1 min-h-0 p-4 font-mono text-sm">
        <div
          ref={activeRef}
          onScroll={onViewportScroll}
          className={`h-full w-full overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent ${viewportClassName || ""}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

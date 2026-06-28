import { cn } from "@/utils/cn";

interface SkeletonProps {
  className?: string;
  width?: string;
  height?: string;
}

export function Skeleton({ className, width, height }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[8px] bg-surface ring-1 ring-inset ring-black/10",
        className
      )}
      style={{ width, height }}
    />
  );
}

interface SkeletonTextProps {
  lines?: number;
  widths?: string[];
  className?: string;
}

const defaultWidths = ["100%", "80%", "60%", "70%", "50%"];

export function SkeletonText({ lines = 3, widths, className }: SkeletonTextProps) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          width={widths?.[i] || defaultWidths[i % defaultWidths.length]}
          height="12px"
        />
      ))}
    </div>
  );
}

export function SkeletonCard({
  title,
  children,
}: {
  title?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-[12px] border-2 border-black bg-background">
      {title && (
        <div className="flex items-center gap-2.5 border-b-2 border-black bg-surface/50 px-5 py-3">
          <Skeleton width="14px" height="14px" />
          <Skeleton width="100px" height="12px" />
        </div>
      )}
      <div className="p-5">{children || <SkeletonText lines={3} />}</div>
    </div>
  );
}

export function SkeletonStatBox() {
  return (
    <div className="space-y-3 rounded-[12px] border-2 border-black bg-background p-4">
      <div className="flex items-center gap-2">
        <Skeleton width="14px" height="14px" />
        <Skeleton width="55px" height="10px" />
      </div>
      <Skeleton width="70px" height="20px" />
    </div>
  );
}

export function SkeletonTerminal() {
  return (
    <div className="rounded-[12px] border-2 border-black bg-[#0a0a0a]">
      <div className="flex items-center gap-2 border-b border-[#1a1a1a] px-4 py-2.5">
        <Skeleton width="12px" height="12px" />
        <Skeleton width="12px" height="12px" />
        <Skeleton width="12px" height="12px" />
        <Skeleton width="60px" height="10px" className="ml-2" />
      </div>
      <div className="space-y-2 p-4">
        <Skeleton width="100%" height="14px" />
        <Skeleton width="85%" height="14px" />
        <Skeleton width="70%" height="14px" />
        <Skeleton width="90%" height="14px" />
        <Skeleton width="45%" height="14px" />
      </div>
    </div>
  );
}

export function SkeletonFileItem() {
  return (
    <div className="flex items-center gap-3 rounded-[8px] border border-border bg-background px-4 py-3">
      <Skeleton width="18px" height="18px" />
      <div className="flex-1 space-y-1.5">
        <Skeleton width="140px" height="12px" />
        <Skeleton width="80px" height="10px" />
      </div>
      <Skeleton width="50px" height="10px" />
    </div>
  );
}

export function SkeletonConfigLine() {
  return (
    <div className="flex items-center gap-3 rounded-[8px] border border-border bg-background px-4 py-2.5">
      <Skeleton width="120px" height="12px" />
      <div className="flex-1" />
      <Skeleton width="80px" height="12px" />
    </div>
  );
}

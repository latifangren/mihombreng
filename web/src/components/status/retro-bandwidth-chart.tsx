import { useMemo } from "react";
import { formatBytes } from "@/utils/format";

interface ChartDataPoint {
  time: string;
  down: number;
  up: number;
}

interface RetroBandwidthChartProps {
  data: ChartDataPoint[];
  maxPoints?: number;
}

export function RetroBandwidthChart({ data, maxPoints = 60 }: RetroBandwidthChartProps) {
  // SVG size setup
  const vWidth = 600;
  const vHeight = 220;
  const padding = { top: 15, right: 15, bottom: 25, left: 65 };

  const chartWidth = vWidth - padding.left - padding.right;
  const chartHeight = vHeight - padding.top - padding.bottom;

  // Calculate scaling factors
  const { maxVal, points } = useMemo(() => {
    // Fill up array with mock empty points if the history is short so it fills from right
    const needed = Math.max(0, maxPoints - data.length);
    const startPoints: ChartDataPoint[] = Array.from({ length: needed }, () => ({
      time: "",
      down: 0,
      up: 0,
    }));
    const combinedPoints = [...startPoints, ...data].slice(-maxPoints);

    let max = 1024 * 10; // default minimum ceiling (10 KB/s)
    for (const p of combinedPoints) {
      if (p.down > max) max = p.down;
      if (p.up > max) max = p.up;
    }
    // Round max value upstream for cleaner Y grid lines
    const orderOfMagnitude = Math.pow(10, Math.floor(Math.log10(max)));
    const roundedMax = Math.ceil(max / (orderOfMagnitude / 2)) * (orderOfMagnitude / 2);

    return { maxVal: roundedMax || 1024, points: combinedPoints };
  }, [data, maxPoints]);

  // Build SVG paths
  const downloadPath = useMemo(() => {
    if (points.length === 0) return "";
    return points
      .map((p, idx) => {
        const x = padding.left + (idx / (maxPoints - 1)) * chartWidth;
        const ratio = p.down / maxVal;
        const y = padding.top + chartHeight - ratio * chartHeight;
        return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }, [points, maxVal, maxPoints, chartWidth, chartHeight, padding.left, padding.top]);

  const uploadPath = useMemo(() => {
    if (points.length === 0) return "";
    return points
      .map((p, idx) => {
        const x = padding.left + (idx / (maxPoints - 1)) * chartWidth;
        const ratio = p.up / maxVal;
        const y = padding.top + chartHeight - ratio * chartHeight;
        return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }, [points, maxVal, maxPoints, chartWidth, chartHeight, padding.left, padding.top]);

  // Build grid lines
  const gridLines = useMemo(() => {
    const lines = [];
    const count = 4; // 4 lines (0%, 33%, 66%, 100%)
    for (let i = 0; i <= count; i++) {
      const ratio = i / count;
      const y = padding.top + chartHeight - ratio * chartHeight;
      const val = ratio * maxVal;
      lines.push({ y, label: `${formatBytes(val)}/s` });
    }
    return lines;
  }, [maxVal, chartHeight, padding.top]);

  return (
    <div className="relative rounded-[12px] border-2 border-black bg-surface p-4 shadow-[4px_4px_0_#000]">
      <div className="mb-2 flex items-center justify-between border-b-2 border-black bg-black/5 px-3 py-1">
        <span className="font-heading text-xs uppercase tracking-wide text-text">Real-time Bandwidth</span>
        <div className="flex gap-4 font-mono text-[10px] uppercase">
          <span className="flex items-center gap-1.5 text-primary">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Download
          </span>
          <span className="flex items-center gap-1.5 text-danger">
            <span className="h-2 w-2 rounded-full bg-danger" />
            Upload
          </span>
        </div>
      </div>

      <div className="overflow-hidden">
        <svg viewBox={`0 0 ${vWidth} ${vHeight}`} className="w-full overflow-visible">
          <title>Real-time Bandwidth Graph</title>
          {/* Grid lines & Y labels */}
          {gridLines.map((line) => (
            <g key={line.y} className="opacity-40">
              <line
                x1={padding.left}
                y1={line.y}
                x2={vWidth - padding.right}
                y2={line.y}
                stroke="#000"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 8}
                y={line.y + 3}
                textAnchor="end"
                className="fill-text font-mono text-[9px] font-bold"
              >
                {line.label}
              </text>
            </g>
          ))}

          {/* X axis line */}
          <line
            x1={padding.left}
            y1={vHeight - padding.bottom}
            x2={vWidth - padding.right}
            y2={vHeight - padding.bottom}
            stroke="#000"
            strokeWidth={2}
          />

          {/* Time markings (start and end) */}
          <text
            x={padding.left}
            y={vHeight - 8}
            className="fill-text-muted font-mono text-[8px]"
          >
            {maxPoints}s ago
          </text>
          <text
            x={vWidth - padding.right}
            y={vHeight - 8}
            textAnchor="end"
            className="fill-text-muted font-mono text-[8px]"
          >
            Now
          </text>

          {/* Data lines */}
          {downloadPath && (
            <path
              d={downloadPath}
              className="fill-none stroke-primary"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {uploadPath && (
            <path
              d={uploadPath}
              className="fill-none stroke-danger"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </div>
    </div>
  );
}

# utils/

## Responsibility
Pure utility functions — provides formatting helpers for display values and a Tailwind class name merging helper. All functions are stateless, side-effect-free, and testable in isolation.

## Design
- **`format.ts`** — three formatting functions:
  - `formatBytes(bytes)` — converts byte count to human-readable string (B/KB/MB/GB/TB) using base-1024 logarithmic unit selection.
  - `formatDuration(seconds)` — converts seconds to compound duration string (`Xd Xh Xm Xs`), omitting zero-value components.
  - `formatTraffic(bytes)` — converts bytes/sec to human-readable rate string (B/s through GB/s), same logarithmic approach as `formatBytes`.
- **`cn.ts`** — `cn(...inputs)` combines `clsx` conditional class composition with `tailwind-merge` for conflict-free Tailwind class merging. Standard pattern in Tailwind CSS projects.

## Flow
- **Formatting**: Consumer passes raw numeric value → function computes unit index via `Math.floor(Math.log(n) / Math.log(1024))` → returns formatted string with unit suffix.
- **Class merging**: Consumer passes conditional Tailwind classes → `clsx` resolves truthy/falsy → `twMerge` deduplicates/resolves conflicting utilities (e.g., `px-2 px-4` → `px-4`).

## Integration
- **Consumers**: `app/page.tsx` (formatBytes, formatDuration, formatTraffic), `app/mihomo/config/page.tsx` (cn)
- **Dependencies**: `clsx`, `tailwind-merge` (npm packages)

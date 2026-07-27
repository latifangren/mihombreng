# status/

## Responsibility
Status visualization components displaying runtime state, traffic metrics, and real-time network throughput of the Mihomo core: tunnel mode indicators, variant-colored status cards, grid-based stats rows, and an SVG bandwidth timeline chart. All are presentational components rendering props without direct backend state mutation.

## Design
- **RetroBandwidthChart** (`retro-bandwidth-chart.tsx`): SVG bandwidth timeline chart component. Renders real-time download and upload rate history using dual SVG paths (green for download, cyan for upload) with gradient area fills. Includes dynamic Y-axis ceiling calculation, formatted labels via `formatBytes`, retro grid background lines, and configurable data point windowing (`maxPoints`, default 60).
- **TunnelIndicator**: Renders a pill-shaped badge for the current tunnel mode (`TUN` | `TPROXY` | `REDIRECT` | `OFF`). Uses a `modeConfig` lookup table mapping each `TunnelMode` to label, border/text color, and dot color. Accepts `running` flag—when `false`, forces display to `OFF` mode regardless of `mode` prop. Supports `sm`/`md` sizes via `sizeMap`.
- **StatusCard**: Wraps `@/components/ui/card` with a colored left border (`accentMap`) and a status dot (`dotMap`). Accepts `variant` (`success` | `warning` | `danger` | `info`) driving both border accent and dot color. Renders label, value (string or ReactNode), and optional icon.
- **StatsRow**: CSS Grid layout (2-col mobile, 4-col `md+`) rendering an array of `{ label, value, icon }` items. Uses `gap-px` with `bg-border` parent to create 1px grid lines between cells—cell backgrounds are `bg-surface`.
- **Styling utility**: All components use `cn()` (`clsx` + `tailwind-merge`) for conditional class composition.

## Flow
- `RetroBandwidthChart`: Accepts `data` points (`time`, `down`, `up`) → scales max bandwidth to clean order-of-magnitude ceiling → builds SVG path d-strings for download/upload lines and area paths → renders grid, legend, axis, and lines.
- `TunnelIndicator`: `mode` + `running` → compute `effective` mode (falls back to `"off"` when not running) → lookup `modeConfig[effective]` → render border, dot, label.
- `StatusCard`: `variant` → lookup `accentMap` / `dotMap` → compose classes → render inside `Card`.
- `StatsRow`: `items` array → map to grid cells, each rendering icon (optional), label, and truncated value.

## Integration
- **Dependencies**: `@/components/ui/card` (`Card`), `@/utils/cn` (`cn`), `@/utils/format` (`formatBytes`).
- **Consumers**: `app/page.tsx` (Dashboard) renders `RetroBandwidthChart`, `StatusCard`, and `StatsRow`. `Topbar` imports `TunnelIndicator` for TUN mode display.

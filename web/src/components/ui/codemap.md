# ui/

## Responsibility
Reusable, low-level UI primitives shared across the application: a 3D retro-styled button, a generic card container, a badge pill, state feedback containers, update notification banners, and a family of skeleton loading placeholders. All are presentational, stateless components accepting className overrides via `cn()`.

## Design
- **RetroBtn**: 3D push-button effect using three stacked `<span>` layers—shadow (black offset), middle (accent color offset), and face (interactive surface). Variants: `primary`, `danger`, `warning`, `ghost`. Sizes: `sm`, `md`, `lg`—each defining padding, font size, shadow depth, and translate offsets. Hover lifts the face layer (`-translate-y-0.5`); active press translates down and removes shadow. Loading state shows a spinning border. Extends native `ButtonHTMLAttributes` for full HTML button API passthrough.
- **Card**: Generic container with rounded border, surface background, and padding. Optional header section renders `icon` + `title` + `action` slot above children. Extends `HTMLAttributes<HTMLDivElement>`.
- **Badge**: Inline pill with semicircular border and background tint. Variants: `success`, `warning`, `danger`, `info`, `default`—each mapping to Tailwind color tokens with 20% opacity backgrounds and 30% opacity borders. Mono font, uppercase, 11px text.
- **DataState** (`data-state.tsx`): Container for data state feedback (empty state, error state, or info notices). Renders title, message, optional icon, and optional action slot with variant tone styles (`neutral`, `danger`, `warning`, `success`) and retro offset shadows (`shadow-[6px_6px_0_#000]`).
- **FreshnessPill** (`data-state.tsx`): Inline timestamp badge displaying data freshness (`Updated <time ago>`, loading status, or error indicator) with color-coded dots (`primary`, `warning`, `danger`).
- **UpdateWarningBanner** (`update-warning-banner.tsx`): System update notification banner. Renders when `update.has_update` is true, displaying current vs. latest version, changelog preview (up to 4 lines), backup warning callout, and a quick navigation button to Backup & Sync (`/backup`).
- **Skeleton family**: Six exported components:
  - `Skeleton` — base pulsing placeholder (animated via `animate-pulse`), configurable `width`/`height`.
  - `SkeletonText` — multi-line text placeholder with configurable line count and per-line widths (defaults: 100%, 80%, 60%, 70%, 50% cycling).
  - `SkeletonCard` — card-shaped skeleton with optional title bar.
  - `SkeletonStatBox` — stat widget skeleton (icon + label + value).
  - `SkeletonTerminal` — terminal-window-shaped skeleton with dots and line placeholders.
  - `SkeletonFileItem` — file-list-item skeleton (icon + name/size).
  - `SkeletonConfigLine` — config key/value pair skeleton.

## Flow
All components are pure render functions. Data flows in via props; no internal state, effects, or callbacks beyond native button/link interactions.

- `RetroBtn`: `variant` + `size` → lookup `variantMap` + `sizeMap` → compose three layered spans → CSS transitions handle hover/active animation.
- `Card`: `title`/`icon`/`action` presence → conditionally render header block → render `children`.
- `Badge`: `variant` → lookup `vMap` → single `<span>` with composed classes.
- `DataState`: `tone` → map background/border style → render icon, title, message, and action element.
- `FreshnessPill`: `loading`/`error`/`stale`/`lastUpdatedAt` → calculate formatted relative time → render status pill.
- `UpdateWarningBanner`: `update.has_update` check → preview changelog lines → render alert container with backup advice & link to `/backup`.
- `Skeleton*`: Props configure dimensions/structure → render `Skeleton` primitives with `animate-pulse`.

## Integration
- **Dependencies**: `@/utils/cn` (`cn`), `@/types` (`AppUpdateCheck`), `react-router-dom` (`useNavigate`), `lucide-react`.
- **Consumers**: `RetroBtn` used by `ErrorBoundary` and page actions. `Card` used by `StatusCard` and page panels. `Badge` used across dashboard/status views. `DataState` & `FreshnessPill` used by `app/settings/page.tsx`, `app/unlock-test/page.tsx`, etc. `UpdateWarningBanner` consumed by `app/settings/page.tsx`. Skeletons used by loading states across page components.

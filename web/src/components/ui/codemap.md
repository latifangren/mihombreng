# ui/

## Responsibility
Reusable, low-level UI primitives shared across the application: a 3D retro-styled button, a generic card container, a badge pill, and a family of skeleton loading placeholders. All are presentational, stateless components accepting className overrides via `cn()`.

## Design
- **RetroBtn**: 3D push-button effect using three stacked `<span>` layers—shadow (black offset), middle (accent color offset), and face (interactive surface). Variants: `primary`, `danger`, `warning`, `ghost`. Sizes: `sm`, `md`, `lg`—each defining padding, font size, shadow depth, and translate offsets. Hover lifts the face layer (`-translate-y-0.5`); active press translates down and removes shadow. Loading state shows a spinning border. Extends native `ButtonHTMLAttributes` for full HTML button API passthrough.
- **Card**: Generic container with rounded border, surface background, and padding. Optional header section renders `icon` + `title` + `action` slot above children. Extends `HTMLAttributes<HTMLDivElement>`.
- **Badge**: Inline pill with semicircular border and background tint. Variants: `success`, `warning`, `danger`, `info`, `default`—each mapping to Tailwind color tokens with 20% opacity backgrounds and 30% opacity borders. Mono font, uppercase, 11px text.
- **Skeleton family**: Six exported components:
  - `Skeleton` — base pulsing placeholder (animated via `animate-pulse`), configurable `width`/`height`.
  - `SkeletonText` — multi-line text placeholder with configurable line count and per-line widths (defaults: 100%, 80%, 60%, 70%, 50% cycling).
  - `SkeletonCard` — card-shaped skeleton with optional title bar.
  - `SkeletonStatBox` — stat widget skeleton (icon + label + value).
  - `SkeletonTerminal` — terminal-window-shaped skeleton with dots and line placeholders.
  - `SkeletonFileItem` — file-list-item skeleton (icon + name/size).
  - `SkeletonConfigLine` — config key/value pair skeleton.

## Flow
All components are pure render functions. Data flows in via props; no internal state, effects, or callbacks beyond `RetroBtn` forwarding native button event handlers via `...props`.

- `RetroBtn`: `variant` + `size` → lookup `variantMap` + `sizeMap` → compose three layered spans → CSS transitions handle hover/active animation.
- `Card`: `title`/`icon`/`action` presence → conditionally render header block → render `children`.
- `Badge`: `variant` → lookup `vMap` → single `<span>` with composed classes.
- `Skeleton*`: Props configure dimensions/structure → render `Skeleton` primitives with `animate-pulse`.

## Integration
- **Dependencies**: `@/utils/cn` (`cn`). `RetroBtn` imports from `react` (`ButtonHTMLAttributes`), `Card` from `react` (`HTMLAttributes`).
- **Consumers**: `RetroBtn` used by `ErrorBoundary` (Try Again / Reload buttons). `Card` used by `StatusCard`. `Badge` used across dashboard/status views. Skeletons used by loading states in page components.

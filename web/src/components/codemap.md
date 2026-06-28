# components/

## Responsibility
React component layer for the Mihombreng XRay control panel. Composes the application's visual hierarchy: layout shell with responsive sidebar/topbar, status visualization primitives, terminal/log-viewing components, reusable UI primitives, and a class-based error boundary for crash recovery. Components are organized by domain into subdirectories (`layout/`, `status/`, `terminal/`, `ui/`) with `error-boundary.tsx` at the root level.

## Design
- **Directory organization**: Domain-grouped subdirectories rather than atomic design. Each subdirectory contains 3–6 closely related presentational components.
- **Stateless by default**: All subdirectory components (`layout/`, `status/`, `terminal/`, `ui/`) are functional components with no local state, except `Shell` (sidebar visibility) which owns the only piece of local UI state in the component tree.
- **ErrorBoundary**: Class-based React error boundary (`Component<Props, State>`) using `getDerivedStateFromError`. Catches render errors, displays error message with "Try Again" (resets state) and "Reload Page" (`window.location.reload()`) actions. Accepts optional `fallback` ReactNode override.
- **App wrapping**: `App.tsx` wraps each page route in `<ErrorBoundary>` via a thin `E` helper component, providing per-route crash isolation. `Shell` is the layout route element, not wrapped by ErrorBoundary (layout-level errors propagate to root).
- **Styling system**: Tailwind CSS with custom theme tokens (`bg-surface`, `bg-primary`, `text-danger`, etc.), retro/brutalist design language (2px black borders, rounded-[12px], uppercase tracking, `font-heading`/`font-mono`). `cn()` utility (`clsx` + `tailwind-merge`) used universally for conditional class composition.

## Flow
1. `main.tsx` → `createRoot` → `<StrictMode><App /></StrictMode>`.
2. `App.tsx` → `<BrowserRouter>` → `<Routes>` → `<Shell>` as layout route.
3. `Shell` → `useMihomoStatus()` polls backend → passes `status` to `Topbar` → renders `<Outlet>` for child routes.
4. Each child route page wrapped in `<ErrorBoundary>` → page components consume `status/`, `terminal/`, `ui/` primitives.
5. Error boundaries catch render-phase exceptions → display fallback UI with retry options.

## Integration
- **Dependencies**: `react-router-dom` (routing, `NavLink`, `Outlet`), `react-hot-toast` (notifications), `lucide-react` (icons), `@/types` (TypeScript interfaces), `@/hooks/use-mihomo-status` (status polling), `@/utils/cn` (class merging), `@/utils/format` (duration formatting), `@/services/api` (backend communication).
- **Consumers**: `main.tsx` renders `App`. Page components under `@/app/` consume layout, status, terminal, and UI components.

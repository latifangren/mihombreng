# layout/

## Responsibility
Shell-level layout composition providing the application's persistent chrome: a responsive sidebar navigation, a top status bar, and a flexible `<Outlet>`-driven content region. Orchestrates mobile/desktop sidebar visibility via local state, delegates status fetching to `useMihomoStatus`, and wires menu toggle across child components.

## Design
- **Composition pattern**: `Shell` is the layout root, compositing `Sidebar` and `Topbar` as children, rendering child routes through React Router's `<Outlet>`.
- **Responsive sidebar**: CSS-driven fixed/translate sidebar on mobile (`< lg`), static on desktop. Controlled by `useState<boolean>` (`sidebarOpen`) in `Shell`.
- **Mobile overlay**: Semi-transparent backdrop rendered conditionally when sidebar is open on mobile; clicking dismisses.
- **NavLink-based navigation**: `Sidebar` uses `react-router-dom` `NavLink` with `isActive` callback for active-route styling. Navigation items defined in a static `NAV_ITEMS` array with path, label, icon, and `end` flag.
- **Props-driven children**: `Topbar` accepts `MihomoStatus` and `version` strings; `Sidebar` accepts `onNavigate` callback to close mobile drawer after selection.
- **Icon library**: All icons from `lucide-react`.

## Flow
1. `Shell` mounts → `useMihomoStatus()` polls `mihomoApi.getStatus()` + `mihomoApi.getCoreVersion()` every 5s, returning `{ status, loading, refetch }`.
2. `status` flows down as prop to `Topbar` (for running/stopped dot, uptime, version display) and indirectly to `TunnelIndicator`.
3. `Sidebar` renders `NAV_ITEMS` as `NavLink` components; clicking one triggers `onNavigate` → `setSidebarOpen(false)` on mobile.
4. `Topbar` hamburger button toggles `sidebarOpen` via `onMenuToggle`.
5. Route content renders inside `<main>` via `<Outlet />`.

## Integration
- **Dependencies**: `react-router-dom` (`NavLink`, `Outlet`), `lucide-react`, `@/types` (`MihomoStatus`), `@/hooks/use-mihomo-status`, `@/utils/format` (`formatDuration`), `@/components/status/tunnel-indicator`.
- **Consumers**: `App.tsx` mounts `<Shell />` as the layout route element wrapping all page routes.

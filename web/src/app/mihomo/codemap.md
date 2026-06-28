# app/mihomo/

## Responsibility
Mihomo core management page — provides status display and lifecycle controls (start/stop/restart) for the mihomo proxy core process. Shows running/stopped state with version info, and links to the configuration editor sub-page.

## Design
- **Client-rendered page** — `"use client"` directive.
- **Hook-driven status** — `useMihomoStatus()` provides `status.running`, `status.version`, `loading`, and `refetch`.
- **Action handler abstraction** — generic `handleAction(action, fn)` pattern: sets `actionLoading` string, executes async API call, shows toast, delays `refetch` by 1s to allow server state propagation.
- **Mutually exclusive button states** — Start disabled when running; Stop/Restart disabled when stopped; all disabled during any action.
- **Navigation** — `useNavigate()` from `react-router-dom` links to `/mihomo/config` for config editing.
- **Three cards** — Status (running indicator + version), Controls (start/stop/restart buttons), Configuration (link to editor).

## Flow
1. Page mounts → `useMihomoStatus()` polls status every 5s.
2. Status card shows colored dot (green=running, red=stopped) + Badge (ACTIVE/INACTIVE) + version string.
3. User clicks Start → `handleAction("start", () => mihomoApi.start())` → POST to `/api/v1/mihomo/start`.
4. After 1s delay, `refetch()` re-polls status to update UI.
5. User clicks "Open Config Editor" → `navigate("/mihomo/config")`.

## Integration
- **Hooks**: `use-mihomo-status` → `mihomoApi.getStatus()`, `mihomoApi.getCoreVersion()`
- **Services**: `services/api` → `mihomoApi.start()`, `mihomoApi.stop()`, `mihomoApi.restart()`
- **Components**: `ui/card`, `ui/retro-btn`, `ui/badge`, `ui/skeleton`
- **Router**: `react-router-dom` → `useNavigate`
- **Icons**: `lucide-react` (Activity, Play, Square, RefreshCw, FileCode)
- **Notifications**: `react-hot-toast`

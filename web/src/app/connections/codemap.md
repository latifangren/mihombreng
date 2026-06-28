# web/src/app/connections/

## Responsibility
Connections workspace page — displays active Mihomo proxy connections with search, summary statistics, and a detail inspector panel. Allows operators to inspect and close individual connections for runtime troubleshooting.

## Design
- **Client-rendered page**: `"use client"` directive, single `ConnectionsPage` component.
- **State management**: Local state for connections list, search query, selected connection, and confirm dialog.
- **API-driven**: Fetches from `/api/v1/mihomo/metrics/connections` on mount and via refresh.
- **Summary cards**: Total connections, filtered count, download total, upload total.
- **Detail panel**: Click row → slide-in panel showing destination (IP:port + host), source, network/type/rule badges, chain visualization (DIRECT → proxy chain), traffic counters, close action.
- **Close action**: Confirmation dialog before `DELETE /api/v1/mihomo/connections/:id`.

## Flow
1. Page mounts → `loadConnections()` → `connectionsApi.list()` → populate state.
2. User types in search → filter connections by host, IP, rule, chain, type, network.
3. User clicks row → set `selected` → detail panel renders with full connection metadata.
4. User clicks "Close Connection" → confirm dialog → `connectionsApi.close(id)` → reload list.

## Integration
- **Services**: `services/api` → `connectionsApi.list()`, `connectionsApi.close()`
- **Types**: `ConnectionInfo`, `ConnectionsListResponse`
- **Components**: `ui/card`, `ui/retro-btn`, `ui/badge`
- **Icons**: `lucide-react` (ArrowDownToLine, ArrowUpFromLine, Globe, RefreshCcw, Search, Shield, X)

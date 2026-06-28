# web/src/app/traffic/

## Responsibility
Traffic metrics workspace page — displays aggregated Mihomo traffic data broken down by rule, chain, network type, and connection type. Provides operators with runtime visibility into bandwidth usage patterns.

## Design
- **Client-rendered page**: `"use client"` directive, single `TrafficPage` component.
- **State management**: Local state for traffic data, loading state.
- **API-driven**: Fetches from `/api/v1/mihomo/metrics/traffic` on mount and via refresh.
- **Summary cards**: Total download, total upload, total connections, active rules.
- **Breakdown tables**: 4 tables showing traffic by rule, by chain, by network (tcp/udp), by type. Each table shows name, download, upload, connection count.

## Flow
1. Page mounts → `loadTraffic()` → `trafficApi.getMetrics()` → populate state.
2. Summary cards render aggregated totals from all buckets.
3. Breakdown tables render sorted by download volume (largest first).

## Integration
- **Services**: `services/api` → `trafficApi.getMetrics()`
- **Types**: `TrafficMetrics`, `TrafficMetricBucket`
- **Components**: `ui/card`, `ui/retro-btn`
- **Icons**: `lucide-react` (ArrowDownToLine, ArrowUpFromLine, Globe, RefreshCcw)

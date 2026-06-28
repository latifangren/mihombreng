# app/manager/

## Responsibility
File manager page — browses and manages mihomo configuration files, proxy providers, and rule providers. Displays three categorized lists (configs, proxy providers, rule providers) with the ability to delete config files. Provides empty-state UIs and skeleton loading states.

## Design
- **Client-rendered page** — `"use client"` directive with `useState`/`useEffect` hooks.
- **Parallel data fetching** — `useEffect` fires `Promise.all([mihomoApi.getConfigs(), mihomoApi.getProxyProviders(), mihomoApi.getRuleProviders()])` on mount.
- **Three-section layout** — each section (`Card` with title/icon) renders a list of file entries or empty-state placeholder.
- **Optimistic deletion** — `handleDelete(name)` calls `mihomoApi.deleteConfig(name)`, then filters `configs` state locally on success.
- **Loading skeleton** — `SkeletonFileItem` components shown during `loading` state.
- **Empty state** — `FolderOpen` icon + message + optional "Create Config" action button for configs.

## Flow
1. Page mounts → `loading=true`, `Promise.all` fetches all three file lists in parallel.
2. On resolution → `setConfigs/setProviders/setRules` populated, `loading=false`.
3. Each section renders file names with type badges (`info`=config, `warning`=provider, `success`=rules).
4. Config entries show a delete button (trash icon) → `handleDelete` removes file via API and updates local state.
5. Empty configs section shows a "Create Config" ghost button that toasts a hint.

## Integration
- **Services**: `services/api` → `mihomoApi.getConfigs()`, `mihomoApi.getProxyProviders()`, `mihomoApi.getRuleProviders()`, `mihomoApi.deleteConfig(name)`
- **Components**: `ui/card`, `ui/retro-btn`, `ui/badge`, `ui/skeleton`
- **Icons**: `lucide-react` (FileText, Trash2, FolderOpen)
- **Notifications**: `react-hot-toast`

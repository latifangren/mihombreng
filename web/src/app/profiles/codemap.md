# web/src/app/profiles/

## Responsibility
Profiles workspace page — manages subscription profiles (provider configurations) with list, search, create, edit, delete, and refresh operations. Provides an inspector panel for viewing profile details and linked provider files.

## Design
- **Client-rendered page**: `"use client"` directive, single `ProfilesPage` component.
- **State management**: Local state for profiles list, search query, selected profile, edit/create mode.
- **API-driven**: Fetches from `/api/v1/subscriptions` on mount and via refresh.
- **Summary cards**: Total profiles, active count, last refresh time.
- **Inspector panel**: Click profile → detail view showing name, URL, type, schedule, proxy count, linked provider files.
- **CRUD operations**: Create (URL input), Edit (name/schedule), Delete (with confirm), Refresh (re-fetch from URL).

## Flow
1. Page mounts → `loadProfiles()` → `subscriptionApi.list()` → populate state.
2. User types search → filter profiles by name, URL, type.
3. User clicks profile → detail panel renders with full metadata.
4. User creates/edits/deletes/refreshes → API call → reload list.

## Integration
- **Services**: `services/api` → `subscriptionApi.*` (list, create, update, delete, refresh)
- **Types**: `SubscriptionProfile`, `SubscriptionProfileInput`
- **Components**: `ui/card`, `ui/retro-btn`, `ui/badge`
- **Icons**: `lucide-react` (RefreshCcw, Plus, Trash2, Edit, Search)

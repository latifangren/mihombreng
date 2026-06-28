# src/

## Sub-modules
| Directory | Responsibility | Map |
|-----------|---------------|-----|
| `app/` | Page-level route components — dashboard, backup, logs, manager, mihomo core, config editor, settings, tools. Global CSS theme. | [View](app/codemap.md) |
| `components/` | Reusable UI primitives (Card, RetroBtn, Badge, Skeleton) and domain components (status cards, stats row, terminal, log line, sidebar, topbar, shell, error boundary) | [View](components/codemap.md) |
| `hooks/` | Custom React hooks for polling (status, stats) and WebSocket streaming (logs) with automatic cleanup | [View](hooks/codemap.md) |
| `services/` | HTTP API client layer (mihomoApi, configApi, backupApi, dnsApi, converterApi) and WebSocket log stream factory | [View](services/codemap.md) |
| `types/` | Shared TypeScript interface definitions for all domain models (MihomoStatus, AppConfig, MihomoLog, etc.) | [View](types/codemap.md) |
| `utils/` | Pure utility functions — byte/duration/traffic formatters and Tailwind class name merger (`cn`) | [View](utils/codemap.md) |

## Architecture
Mihombreng is a **React SPA** (Vite-based) serving as the web dashboard for a mihomo proxy core backend. The architecture follows a layered pattern:

```
Pages (app/) → Hooks (hooks/) → Services (services/) → Backend API
    ↓                ↓
Components (components/)    Types (types/) + Utils (utils/)
```

- **Routing**: `react-router-dom` with route-per-directory convention (each `app/*/page.tsx` is a route)
- **State**: Local component state (`useState`) + custom hooks with polling/WebSocket; no global state library
- **Styling**: Tailwind CSS v4 with custom `@theme` dark retro palette, `cn()` utility for conditional classes
- **Backend communication**: Same-origin REST API (`/api/v1/*`) + WebSocket for streaming; all through `services/`
- **UI language**: Retro gaming aesthetic — thick borders, hard shadows (`4px 4px 0 #000`), monospace fonts, neumorphic button states

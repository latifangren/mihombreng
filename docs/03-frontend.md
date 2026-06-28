# Frontend

React + TypeScript SPA served from Go binary via `embed.FS`. Dark retro-brutalist theme.

## Stack

| Layer | Choice |
|---|---|
| Framework | React 19 |
| Build | Vite 7 |
| Language | TypeScript 5.9 |
| Styling | Tailwind CSS v4 |
| Routing | react-router-dom |
| State | React Context (client) |
| Icons | Lucide React |
| Notifications | react-hot-toast (toast) |

## Design System

### Theme

- Dark background (`#1a1a1a`), no light mode
- Retro-brutalist aesthetic: thick borders, 3D buttons, monospace elements
- Cream text on dark (`#f9f4da`)
- Accent palette: green (`#0CA95B`), yellow (`#fcba28`), red (`#f33`), blue (`#14b6e5`), purple (`#9f7aea`), cyan (`#00d4ff`)

### Typography

| Usage | Font |
|---|---|
| Headings | Archivo Black (bold, condensed) |
| Body | Space Grotesk |
| Monospace | JetBrains Mono |

### Components

- `RetroBtn` — multi-layer 3D buttons with shadow, active press state
- `Card` — thick bordered cards with optional accent colors
- `Terminal` — terminal-style log viewer with colored prompt
- Skeleton loading states for async content

## Structure

```text
web/
├── index.html
├── vite.config.ts
├── src/
│   ├── main.tsx                 # Entry, router provider
│   ├── app/
│   │   ├── global.css           # Tailwind v4 + custom utilities
│   │   └── page.tsx             # Dashboard page
│   ├── components/
│   │   ├── ui/
│   │   │   ├── retro-btn.tsx    # 3D retro button
│   │   │   ├── card.tsx         # Themed card
│   │   │   ├── terminal.tsx     # Terminal output
│   │   │   ├── skeleton.tsx     # Loading skeletons
│   │   │   ├── input.tsx        # Styled input
│   │   │   ├── switch.tsx       # Toggle switch
│   │   │   ├── slider.tsx       # Range slider
│   │   │   ├── badge.tsx        # Status badges
│   │   │   ├── tabs.tsx         # Tab navigation
│   │   │   ├── select.tsx       # Dropdown select
│   │   │   └── error-boundary.tsx
│   │   ├── layout/
│   │   │   ├── sidebar.tsx      # Navigation sidebar
│   │   │   └── topbar.tsx       # Status bar
│   │   ├── dashboard/           # Dashboard widgets
│   │   ├── mihomo/              # Mihomo management
│   │   ├── config/              # Config editor
│   │   ├── manager/             # File manager
│   │   ├── logs/                # Log viewer
│   │   ├── tools/               # DNS, converter
│   │   ├── backup/              # Backup/restore
│   │   └── settings/            # App settings
│   ├── hooks/
│   │   ├── use-mihomo.ts        # Mihomo API hooks
│   │   ├── use-config.ts        # Config API hooks
│   │   └── use-backup.ts        # Backup API hooks
│   ├── services/
│   │   ├── api.ts               # HTTP client (fetch wrapper)
│   │   └── ws.ts                # WebSocket manager
│   └── utils/
│       ├── cn.ts                # Tailwind class merge
│       └── format.ts            # Formatting helpers
```

## Development

```sh
cd web
npm install
npm run dev      # Vite dev server on :3333
npm run build    # Production build to dist/
npm run lint     # ESLint
```

Vite proxies `/api` to Go backend during development.

## Build

```sh
npm run build    # Outputs to web/dist/
```

Go backend embeds `web/dist/` via `//go:embed dist/*` in `internal/ui/embed.go`.

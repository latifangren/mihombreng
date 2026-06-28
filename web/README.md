# Mihombreng Web UI

React + TypeScript SPA for managing Mihomo. Served from Go binary via `embed.FS`.

## Stack

- React 19 + TypeScript 5.8
- Vite 7 (build tool)
- Tailwind CSS v4 (styling)
- TanStack Router (routing)
- TanStack Query (server state)
- Lucide React (icons)
- Sonner (toast notifications)

## Development

```sh
npm install
npm run dev      # Vite dev server on :3333
npm run build    # Production build to dist/
npm run lint     # ESLint
```

Vite proxies `/api` requests to Go backend at `:7777`.

## Design

Dark retro-brutalist theme with 3D buttons, thick borders, and monospace elements.

- **Background:** `#1a1a1a`
- **Text:** `#f9f4da` (cream)
- **Accents:** green, yellow, red, blue, purple, cyan
- **Fonts:** Archivo Black (headings), Space Grotesk (body), JetBrains Mono (code)

## Build Output

`npm run build` outputs to `dist/`. Go backend embeds this directory.

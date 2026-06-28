# web/

## Responsibility
React SPA frontend for Mihombreng — provides a retro-brutalist themed web dashboard for managing Mihomo proxy core, viewing logs, editing configs, managing files, performing DNS lookups, converting proxy subscriptions, and managing backups.

## Sub-modules
| Directory | Responsibility | Map |
|-----------|---------------|-----|
| `src/` | Application source — pages, components, hooks, services, types, utils | [View](src/codemap.md) |

## Tech Stack
- **Framework**: React 19 + TypeScript
- **Build**: Vite 7
- **Styling**: Tailwind CSS v4
- **Routing**: React Router v7
- **Code Editor**: Monaco Editor (YAML config editing)
- **Icons**: Lucide React

## Key Files
| File | Purpose |
|------|---------|
| `package.json` | Dependencies and scripts |
| `vite.config.ts` | Build configuration, proxy setup |
| `tsconfig.json` | TypeScript compiler options |
| `eslint.config.js` | Linting rules |
| `index.html` | SPA entry HTML shell |

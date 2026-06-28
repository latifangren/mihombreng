# app/mihomo/config/

## Responsibility
Configuration editor page — a full-featured IDE-like YAML editor for managing mihomo config files, proxy providers, and rule providers. Provides a file sidebar with create/delete/activate operations, multi-tab editing with dirty tracking, Monaco Editor integration, and save functionality.

## Design
- **Client-rendered page** — `"use client"` directive, the largest page component (423 lines).
- **Tab-based editor model** — `FileTab` type tracks `{ name, dirty, content, savedContent, type }` per open file; dirty flag computed as `content !== savedContent`.
- **File sidebar** — three collapsible sections (Configs, Proxy Providers, Rule Providers) fetched via `Promise.all`. Config entries support "Activate" and "Del" actions on hover.
- **Monaco Editor integration** — `@monaco-editor/react` `Editor` component configured for YAML language, dark theme, JetBrains Mono font, minimap, and bracket pair colorization.
- **Toolbar** — shows unsaved/active badges, "Set Active" button for non-active configs, and "Save" button (disabled when clean).
- **New file creation** — inline input with Enter/Escape key handling, creates via `mihomoApi.createConfig()`.
- **Dirty tab confirmation** — `closeTab` prompts `confirm()` before closing tabs with unsaved changes.
- **Refs** — `editorRef` holds Monaco editor instance; `newFileInputRef` for auto-focus on new file input.

## Flow
1. Page mounts → `loadFiles()` fetches configs, providers, rules, and active config name in parallel.
2. User clicks a file in sidebar → `openFile(name, type)` fetches content via type-specific API method, adds `FileTab` to state, sets as active tab.
3. User edits in Monaco → `handleEditorChange` updates tab `content`, recomputes `dirty` flag.
4. User clicks Save → `handleSave()` PUTs content to `/api/v1/mihomo/configs/{name}`, clears dirty flag.
5. User clicks "Activate" → `handleSetActive(name)` PUTs to `/api/v1/mihomo/active-config`.
6. User clicks "Del" → `confirm()` dialog → `handleDelete()` DELETEs config, removes from state and tabs.
7. User clicks tab close → if dirty, confirms → removes tab, adjusts active tab to neighbor.
8. New file: "+ New" → inline input → Enter → `handleCreateFile()` → POST → opens new file in editor.

## Integration
- **Services**: `services/api` → `mihomoApi` (getConfigs, getProxyProviders, getRuleProviders, getActiveConfig, getConfigContent, getProxyProviderContent, getRuleProviderContent, saveConfig, setActiveConfig, createConfig, deleteConfig)
- **Editor**: `@monaco-editor/react` (Editor component, OnMount callback)
- **Utils**: `utils/cn` (className merging)
- **Components**: `ui/retro-btn`, `ui/badge`
- **Icons**: `lucide-react`
- **Notifications**: `react-hot-toast`

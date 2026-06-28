# terminal/

## Responsibility
Terminal/log-viewer UI components providing a monospace-styled window frame (`Terminal`), individual log line rendering with level-based color coding (`LogLine`), and a segmented-filter toolbar for selecting log severity levels (`LogFilter`). All components are stateless presentational renderers.

## Design
- **Terminal**: Generic container mimicking a terminal window. Renders a window chrome bar with three colored dots (red/yellow/green) and optional title, wrapping children in a monospace-styled content area. Dark background (`#0a0a0a`).
- **LogLine**: Renders a single log entry with three columns: timestamp (muted), level badge (colored via `levelStyles` map), and message text. Supports `info`, `warning`/`warn`, `error`, `debug` levels with fallback to default text color for unknown levels.
- **LogFilter**: Controlled segmented-button toolbar. Renders five filter buttons (`All` | `Info` | `Warn` | `Error` | `Debug`) in a row. Active button highlighted with `activeColor`; inactive buttons use `color` with hover transitions. Exports `LogLevel` type (`"all" | "info" | "warning" | "error" | "debug"`). State managed externally via `active`/`onChange` props.
- **Styling**: All monospace (`font-mono`), small text sizes, uppercase tracking for labels. Uses `cn()` for class merging.

## Flow
- `LogFilter`: Parent holds `active: LogLevel` state → `onChange` callback fires on button click → parent updates filter state.
- `LogLine`: Receives `level`, `message`, `timestamp` → `levelStyles[level]` selects text color → renders three-segment line.
- `Terminal`: Pure wrapper; `children` (typically filtered `LogLine` list) rendered inside the frame.

## Integration
- **Dependencies**: `@/utils/cn` (`cn`). No other internal imports.
- **Consumers**: Log pages compose these three components—`Terminal` wraps a scrollable list of `LogLine` items, with `LogFilter` above for level filtering.

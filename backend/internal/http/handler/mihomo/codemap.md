# handler/mihomo/

## Responsibility
HTTP handlers for the mihomo proxy core: service lifecycle control (start/stop/restart), status monitoring, real-time data snapshots (memory, traffic, connections), API proxying to the mihomo core, version detection, dashboard info retrieval, and comprehensive YAML file management across configs, proxy_providers, and rule_providers directories.

## Design
- **Two handler structs** in separate files:
  - `MihomoHandler` (`mihomo.go`): Service control and API proxy. Depends on `domain.MihomoService`, `*config.Config`.
  - `MihomoFilesHandler` (`files.go`): CRUD for YAML files. Depends on `domain.MihomoService`, `*config.Config`, `configPath`.
- **API proxy pattern**: `ProxyToMihomoAPI` forwards requests to the mihomo core's external-controller API, injecting Bearer auth from config.
- **SSE parsing for snapshots**: `GetMemory()` and `GetTraffic()` parse Server-Sent Events stream from mihomo API, extracting the last valid JSON line.
- **Process exec for version**: `GetCoreVersion()` shells out to `mihomo -v` binary.
- **File management with path safety**: All file operations use `validateDir()` (whitelist: `configs`, `proxy_providers`, `rule_providers`), `isYAMLFile()` extension check, and `isPathSafe()` traversal prevention.
- **Auto-restart on config change**: `UpdateFile` and `SetActiveConfigPath` conditionally restart mihomo when the active config is modified and `AutoRestart` is enabled.
- **Active config tracking**: `GetActiveConfigPath`/`SetActiveConfigPath` manage which config file mihomo uses, persisting to app config.

## Flow (mihomo.go)
- **GetStatus**: Read PID file -> signal(0) check -> return running/stopped.
- **Start/Stop/Restart**: Delegate to `mihomoService` methods, map errors via `apperror`.
- **ProxyToMihomoAPI**: Check running status -> build URL from `APIURL + path` -> inject Bearer token -> proxy request -> relay response.
- **GetMemory/GetTraffic**: Check running -> HTTP GET to mihomo SSE endpoint -> parse last JSON line from stream -> return snapshot.
- **GetConnectionsSnapshot**: Check running -> HTTP GET to `/connections` -> JSON decode -> return totals.
- **GetCoreVersion**: Execute `corePath -v` -> parse version string -> return short version.
- **GetDashboardInfo**: Read `ui/` directory entries -> parse port from APIURL -> return port, secret, dashboard list.

## Flow (files.go)
- **GetFiles**: Validate dir -> `os.ReadDir` -> return file names.
- **GetFileContent**: Validate dir + filename -> YAML-only check -> path safety -> `os.ReadFile` -> return content.
- **CreateFile**: Validate -> bind JSON (filename + content) -> YAML check -> path safety -> existence check -> `os.WriteFile`.
- **UpdateFile**: Validate -> bind JSON (content) -> path safety -> existence check -> `os.WriteFile` -> optional auto-restart if active config.
- **DeleteFile**: Validate -> path safety -> existence check -> reject if active config -> `os.Remove`.
- **RenameFile**: Validate -> bind JSON (new_filename) -> YAML checks on both names -> path safety -> `os.Rename` -> update config if active config renamed.
- **DownloadFile**: Validate -> path safety -> existence check -> serve via `c.File()`.
- **UploadFile**: Validate dir -> multipart form file -> YAML check -> path safety -> existence check -> `io.Copy` to disk.
- **GetActiveConfigPath**: Return `filepath.Base` of current config path.
- **SetActiveConfigPath**: Bind JSON -> YAML check -> path safety -> existence check -> update config + save -> optional auto-restart.

## Integration
- **Depends on**: `domain.MihomoService` interface (`GetStatus`, `Start`, `Stop`, `Restart`, `ClearLogs`), `pkg/config.Config` (all mihomo settings), `pkg/apperror` (error mapping).
- **Consumed by**: `router.Setup()` registers under `/api/v1/mihomo/` with numerous sub-routes.

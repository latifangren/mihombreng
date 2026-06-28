# handler/app/

## Responsibility
HTTP handlers for application-level configuration management and network identity queries. Provides endpoints to read/update the Mihombreng application config, fetch public IPv4/IPv6 addresses, and retrieve GeoIP data for the machine's public IPs.

## Design
- **Struct handler pattern**: `AppHandler` holds references to `*config.Config`, `domain.MihomoService`, and `configPath`. Constructor `NewAppHandler()` initializes all fields.
- **Dual IP retrieval**: Symmetric `GetIPv4`/`GetIPv6` and `GetGeoIPv4`/`GetGeoIPv6` endpoints delegate to private helper methods `getIP()` and `getGeoIP()` parameterized by external API URL and version label.
- **External HTTP calls**: Uses `net/http.Client` to fetch from `api-ipv4.ip.sb` / `api-ipv6.ip.sb` endpoints.
- **Config mutation with auto-restart**: `UpdateConfig()` updates in-memory config, persists via `config.Save()`, and conditionally restarts mihomo if `AutoRestart` is true and service is running.
- **Swagger annotations**: All public methods have godoc/Swagger metadata.

## Flow
- **GetConfig**: Returns merged config (version, environment, server, mihomo, logging, API) as JSON.
- **GetIPv4/GetIPv6**: HTTP GET to external IP service -> scan response body -> return IP string.
- **GetGeoIPv4/GetGeoIPv6**: HTTP GET to external geoip service -> JSON decode into `GeoIPResponse` struct -> return.
- **UpdateConfig**: Bind JSON -> update `config.Mihomo` and `config.Logging` fields -> save to disk -> if needs restart, call `mihomoService.Restart()`.

## Integration
- **Depends on**: `domain.MihomoService` (for `GetAppConfig()`, `GetStatus()`, `Restart()`), `pkg/config.Config` (read/write), `pkg/apperror` (error status mapping).
- **Consumed by**: `router.Setup()` registers under `/api/v1/app/`.

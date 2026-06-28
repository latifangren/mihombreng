# handler/converter/

## Responsibility
HTTP handler for parsing proxy subscription URLs and individual proxy links into structured `Proxy` objects. Supports multiple input modes: subscription URL fetch, single proxy link parsing, and raw base64 content decoding.

## Design
- **Stateless handler**: `ConverterHandler` has no dependencies (empty struct). Constructor `NewConverterHandler()`.
- **Multi-mode input dispatch**: `ParseProxies()` routes to different parsing strategies based on input characteristics:
  - `Content` field -> `proxylib.ParseSubscription()` (base64 content)
  - `URL` with `http://`/`https://` prefix -> `proxylib.FetchSubscription()` (remote fetch)
  - `URL` with `vmess://`/`vless://`/`trojan://`/`ss://` prefix -> `proxylib.ParseLink()` (single link)
- **Typed request/response**: Uses `ParseRequest` (URL or Content) and `ParseResponse` (Success, Proxies, Count, Error) structs.

## Flow
1. Bind JSON to `ParseRequest`.
2. Determine input type by field presence and URL scheme prefix.
3. Delegate to `internal/converter` library function.
4. Return `ParseResponse` with parsed proxy list and count, or error.

## Integration
- **Depends on**: `internal/converter` package (aliased as `proxylib`) for `ParseSubscription`, `FetchSubscription`, `ParseLink`, `Proxy` type.
- **Consumed by**: `router.Setup()` registers under `/api/v1/converter/parse`.

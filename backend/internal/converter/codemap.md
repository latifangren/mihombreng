# converter/

## Responsibility
Proxy link parsing and subscription conversion layer. Parses standard proxy URI schemes (vmess://, vless://, trojan://, ss://) into a unified `Proxy` data structure suitable for mihomo YAML configuration. Also fetches and decodes base64-encoded subscription feeds, splitting them into individual proxy links. Supports high-performance Rust FFI payload parsing with Go fallback.

## Design
- **Unified proxy model** (`types.go`): `Proxy` struct is a superset of all protocol fields — UUID for vmess/vless, password for trojan/ss, cipher, TLS options, transport-specific paths (WS, gRPC, SplitHTTP, XHTTP, HTTPUpgrade), flow control, plugins. Dual-annotated with `json` and `yaml` tags.
- **Protocol type enum**: `ProxyType` string constants (`vmess`, `vless`, `trojan`, `ss`).
- **Dispatcher pattern** (`parser.go`): `ParseLink(link)` inspects URI prefix and dispatches to protocol-specific parsers. `ParseLinks(links)` batch-processes with error accumulation (partial success allowed).
- **Protocol parsers**: Each in its own file:
  - `vmess.go` — Base64-decoded JSON payload. Handles polymorphic port/aid fields via `getStringValue()`. Maps `net` field to transport-specific proxy fields.
  - `vless.go` — URI-style `uuid@server:port#remark?query` format. Parses `url.ParseQuery` for security, SNI, ALPN, flow, network type.
  - `trojan.go` — URI-style `password@server:port#remark?query`. Same query parameter handling as vless.
  - `ss.go` — Two formats: `ss://base64(method:password@server:port)#remark` and `ss://base64 userinfo@server:port`. Parses plugin options from query string.
- **Subscription handling** (`subscription.go`): `FetchSubscription(url)` fetches URL content, attempts base64 decode (standard → raw → passthrough), splits by newline, delegates to `ParseLinks`.
- **Rust FFI acceleration** (`rust_cgo.go`, `rust_nocgo.go`):
  - `rust_cgo.go` (`//go:build cgo && rust_ffi`): `ParseSubscriptionRust(content)` delegates subscription payload parsing via CGO to native C library `parse_subscription_payload`. `IsRustAvailable()` returns `true`.
  - `rust_nocgo.go` (`//go:build !cgo || !rust_ffi`): Fallback implementation returning error and `IsRustAvailable() = false` when CGO/Rust FFI is unavailable.

## Flow
```
FetchSubscription(url)
  → HTTP GET (30s timeout)
    → If Rust FFI available: ParseSubscriptionRust(content)
    → Else: base64.DecodeString (try std, then raw, then passthrough)
      → strings.Split(newline)
        → ParseLinks(lines)
          → for each line: ParseLink(link)
            ├── vmess:// → ParseVMess → base64 decode → JSON unmarshal → Proxy
            ├── vless:// → ParseVLess → URI parse → query params → Proxy
            ├── trojan:// → ParseTrojan → URI parse → query params → Proxy
            └── ss:// → ParseSS → base64 decode → method:password split → Proxy
```

### Supported Transport Types (vmess/vless/trojan)
| `type` field | Proxy field mapped |
|---|---|
| `ws` / `websocket` | `WSPath`, `WSHeaders["Host"]` |
| `grpc` | `GRPCServiceName` |
| `splithttp` | `SplitHTTPPath` |
| `xhttp` | `XHTTPPath` |
| `httpupgrade` | `HTTPUpgradePath` |

## Integration
| Dependency | Direction | Purpose |
|---|---|---|
| `internal/service/*` | consumed by | MihomoService uses converter to parse subscriptions/links into config |
| stdlib `net/http` | uses | Subscription URL fetching |
| stdlib `encoding/base64` | uses | Subscription + vmess/ss link decoding |
| stdlib `encoding/json` | uses | vmess JSON config parsing |
| stdlib `net/url` | uses | URI + query parameter parsing (vless, trojan, ss) |
| Rust FFI (`crates/mihombreng-converter`) | optional | Fast Rust subscription payload parsing bridge (`rust_cgo.go`) |

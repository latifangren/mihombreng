# routing/

## Responsibility
Linux nftables-based network routing subsystem implementing three transparent proxy modes: TUN (mark-based routing through a TUN device), TPROXY (transparent proxy with policy routing), and REDIRECT (NAT-based TCP redirection). Orchestrates creation and cleanup of nftables rules, routing tables, policy routing rules, bypass validation, and CIDR interval calculation for intercepting system traffic and forwarding it through mihomo.

## Design
- **Service per mode**: Each routing mode is a separate struct with `Setup()` and `Cleanup()` methods:
  - `TUNService` (`tun.go`): Mark-and-route approach using a `mihombreng_tun` nftables table with mangle chains. Creates routing table 200, marks packets with 200, and routes marked packets to the TUN interface. Handles OpenWrt fw4 detection for firewall chain integration.
  - `TProxyService` (`tproxy.go`): Full TPROXY implementation using `mihombreng_tproxy` inet table. Creates reserved IP sets (RFC ranges) to bypass, applies TPROXY marks and redirection for both TCP and UDP. Manages policy routing rules (table 80) via netlink for both IPv4 and IPv6.
  - `RedirectService` (`redirect.go`): Simple NAT REDIRECT using `mihombreng_redirect` inet table. Output chain redirects TCP to port 7891, skipping loopback, mihomo-marked, and local network traffic.
- **Facade pattern**: `NftablesService` (`nftables.go`) coordinates all three services. `SetupRouting()` validates bypass configuration via `validation.go`, cleans up existing rules, then selectively activates modes based on `RoutingConfig.TCP` and `RoutingConfig.UDP` settings.
- **Configuration Validation** (`validation.go`): `validateBypassConfig()` verifies MAC addresses, IPv4 CIDRs/IPs, and IPv6 CIDRs/IPs in `RoutingConfig`, returning detailed error issues.
- **Dual Rust FFI / Native Fallback for CIDR Merging**:
  - `rust_cgo.go` (`//go:build cgo && rust_ffi`): Invokes CGO FFI `parse_and_merge_cidrs` from native Rust library `mihombreng-converter` to parse and interval-merge CIDR blocks into `nftables.SetElement` arrays. `IsRustCIDRMergerAvailable()` returns `true`.
  - `rust_nocgo.go` (`//go:build !cgo || !rust_ffi`): Fallback stub when CGO/Rust FFI is disabled. `ParseAndMergeCIDRsRust()` returns error and `IsRustCIDRMergerAvailable()` returns `false`.
- **Separate nftables connections**: Each mode gets its own `nftables.Conn` for atomic flush operations.
- **IP set construction**: TProxy builds interval-based nftables sets from RFC-reserved CIDR ranges (IPv4 and IPv6) with overlap merging for efficiency.
- **OpenWrt detection**: TUN service detects fw4 table presence and inserts rules into OpenWrt's existing firewall chains instead of standalone chains.

## Flow
- **SetupRouting**: Validate bypass config via `validateBypassConfig()` -> Cleanup all existing rules -> if TPROXY needed: create nftables conn -> `TProxyService.Setup()` (create table, sets, prerouting/output chains with TPROXY rules, using Rust CIDR merger if available or native fallback) -> flush -> add policy routing (netlink rules/routes). If TUN needed: create conn -> `TUNService.Setup()` (create routing table via netlink, create nftables marking rules in mihombreng_tun table) -> flush. If REDIRECT needed: create conn -> `RedirectService.Setup()` (create nat output chain) -> flush.
- **CleanupAllRouting**: Single nftables conn -> Cleanup all three services -> flush.
- **TUN Setup**: Detect OpenWrt fw4 -> create routing table (netlink rule+route for mark 200 -> table 200) -> create mangle rules (prerouting + output chains in mihombreng_tun table, mark TCP/UDP packets, skip loopback/TUN/local networks).
- **TProxy Setup**: Create inet table `mihombreng_tproxy` -> build reserved IP sets -> prerouting chain (reject UDP:443, skip mihomo-marked, apply TPROXY for TCP/UDP, skip return traffic/reserved IPs) -> output chain (same pattern for locally-originated traffic) -> policy routing (netlink rules for mark 0x80 -> table 80 -> lo local).
- **Redirect Setup**: Create inet table `mihombreng_redirect` -> nat output chain -> accept loopback, return mihomo-marked, skip local networks, REDIRECT TCP to port 7891.

## Integration
- **Depends on**: `sagernet/nftables` + `sagernet/nftables/expr` (nftables rule construction), `vishvananda/netlink` (routing tables, rules, interface lookup), `golang.org/x/sys/unix` (protocol constants), `pkg/config` (RoutingConfig, RoutingMode constants), `pkg/logger`, Rust FFI (`mihombreng-converter` via CGO when `cgo && rust_ffi`).
- **Implements**: `domain.NftablesService` interface.
- **Consumed by**: `service.MihomoService` calls `SetupRouting()` and `CleanupAllRouting()` during process lifecycle.

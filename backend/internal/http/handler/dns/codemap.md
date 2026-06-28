# handler/dns/

## Responsibility
HTTP handler for DNS resolution lookups. Accepts a domain name and returns all resolved IPv4 and IPv6 addresses using Go's standard library DNS resolver.

## Design
- **Stateless handler**: `DNSHandler` has no dependencies (empty struct). Constructor `NewDNSHandler()`.
- **Typed request/response**: `LookupRequest` (domain, required) and `LookupResponse` (Success, Domain, IPv4, IPv6, Error).
- **Standard library resolution**: Uses `net.LookupIP()` which delegates to the system resolver.
- **IPv4/IPv6 classification**: Iterates results, classifying by `ip.To4() != nil` check.

## Flow
1. Bind JSON to `LookupRequest` (domain is required).
2. Call `net.LookupIP(domain)`.
3. Partition results into IPv4 and IPv6 string slices.
4. Return `LookupResponse` with both lists.

## Integration
- **Depends on**: Standard library `net` package only.
- **Consumed by**: `router.Setup()` registers under `/api/v1/dns/lookup`.

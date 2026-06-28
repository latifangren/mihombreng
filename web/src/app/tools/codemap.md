# app/tools/

## Responsibility
Utility tools page — provides two standalone tools: DNS lookup (resolves a domain name via the backend DNS API) and subscription converter (parses a proxy subscription URL and returns proxy count). Both tools are simple input→action→result cards.

## Design
- **Client-rendered page** — `"use client"` directive.
- **Dual tool layout** — two independent `Card` sections, each with an input field and action button.
- **Local state per tool** — DNS: `domain`, `dnsResult`, `dnsLoading`; Converter: `subUrl`, `converterResult`, `convLoading`.
- **Enter-key support** — DNS input handles Enter key for quick lookup.
- **No shared state** — tools are fully independent; no cross-tool communication.

## Flow
1. Page renders two cards: "DNS Lookup" and "Subscription Converter".
2. DNS: user types domain → clicks "Lookup" (or Enter) → `dnsApi.lookup(domain)` POSTs to `/api/v1/dns/lookup` → result IP displayed inline.
3. Converter: user pastes subscription URL → clicks "Parse" → `converterApi.parse(subUrl)` POSTs to `/api/v1/converter/parse` → proxy count displayed inline.
4. Loading states disable buttons and show loading text during API calls.

## Integration
- **Services**: `services/api` → `dnsApi.lookup()`, `converterApi.parse()`
- **Components**: `ui/card`, `ui/retro-btn`
- **Icons**: `lucide-react` (Globe, Repeat)

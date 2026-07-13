# rule_providers/

## Responsibility
Default rule provider definition file serving as a placeholder template for Mihomo rule provider payloads. Provides the initial empty `payload` array that users populate to define custom routing rules (domain-based, IP-based, or process-based) that augment or replace the base rule set for traffic classification and proxy path selection.

## Design
Single YAML file (`rule.yaml`) conforming to Mihomo's rule-provider file schema. Contains a top-level `payload:` key with an empty list as the default seed. Rule providers in Mihomo support multiple types (domain, ipcidr, classical) and can be hosted as remote URLs or local files. This local file serves as the on-disk template for rules managed through the application's web interface.

## Flow
```
config.yaml (future rule-provider reference)
  └─> rule.yaml (loaded by mihomo core when referenced)
        └── payload: [] (empty by default)
              └── Populated via:
                    ├── Web UI -> POST /api/v1/mihomo/rule-provider (create)
                    ├── Web UI -> POST /api/v1/mihomo/rule-provider/upload (multipart)
                    └── Direct file edit via config editor
```

## Integration
- **API**: CRUD operations at `/api/v1/mihomo/rule-provider/*` (list, read, create, update, delete, upload, download, rename)
- **Config reference**: Mihomo `config.yaml` can reference rules from this directory via `rule-provider` block with `path: ./rule_providers/rule.yaml`
- **Frontend**: File manager component (`web/src/components/manager/`) and rule provider UI manage this file
- **Note**: Not currently referenced in the default `config.yaml` (Phase 2 roadmap item)

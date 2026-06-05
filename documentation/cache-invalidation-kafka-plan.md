# Plan: Move Cache Invalidation to Kafka Consumers

Move all direct `CacheService.invalidate*` calls out of services and into the existing `EventConsumer`, driven by Kafka events. This decouples cache management from business logic and makes invalidation async and consistent with the existing `IAM_PERMISSION_CHANGED` pattern already in `EventConsumer`.

## Scope

- **In:**
  - Add `IAM_ACL_CHANGED` to `KAFKA_TOPICS`
  - Add `invalidateAclCache` helper to `CacheService` (covers the `acl:` prefix key)
  - Replace inline `invalidateAuthzDecision` + `cacheManager.del` calls in `AclService` with `eventProducer.emit(IAM_ACL_CHANGED, ...)`
  - Add `@EventPattern(IAM_ACL_CHANGED)` handler in `EventConsumer`
  - Register `IAM_ACL_CHANGED` topic in docker-compose `kafka-init` / topic config if needed

- **Out:**
  - Changing how `IAM_PERMISSION_CHANGED` is consumed (already correct in `EventConsumer`)
  - Modifying audit event emission
  - Any SDK or showcase changes

## Current State

| Location | Direct call | Should become |
|---|---|---|
| `acl.service.ts:103` | `cacheService.invalidateAuthzDecision(...)` | emit `IAM_ACL_CHANGED` |
| `acl.service.ts:102` | `cacheManager.del(aclKey)` | emit `IAM_ACL_CHANGED` |
| `acl.service.ts:159` | `cacheService.invalidateAuthzDecision(...)` | emit `IAM_ACL_CHANGED` |
| `acl.service.ts:158` | `cacheManager.del(aclKey)` | emit `IAM_ACL_CHANGED` |

`IAM_PERMISSION_CHANGED` → `invalidateUserPermissionCache` / `invalidateTenantPermissionCache` already handled in `EventConsumer` — no change needed there.

## Action Items

- [ ] **Add `IAM_ACL_CHANGED` topic** — in `src/common/constants/kafka.constant.ts`, add `IAM_ACL_CHANGED: 'iam.acl.changed'` to `KAFKA_TOPICS`
- [ ] **Add `invalidateAclCache` to `CacheService`** — new method in `src/cache/cache.service.ts` that deletes the `acl:{tenantId}:{userId}:{resourceType}:{resourceId}:{permission}` key, mirroring the `getCacheKey` logic currently inlined in `AclService`
- [ ] **Emit `IAM_ACL_CHANGED` from `AclService`** — in `createAcl` and `deleteAcl`, replace the two inline cache deletions with a single `eventProducer.emit(KAFKA_TOPICS.IAM_ACL_CHANGED, { tenant_id, user_id, permission, resource_type, resource_id })`. Remove `@Inject(CACHE_MANAGER)` and `cacheService` usage if no longer needed.
- [ ] **Add `AclChangedEvent` interface and handler in `EventConsumer`** — `@EventPattern(IAM_ACL_CHANGED)` calls `cacheService.invalidateAclCache(...)` then `cacheService.invalidateAuthzDecision(...)`
- [ ] **Register new topic for local dev** — add `iam.acl.changed` to `kafka-init` topics in `docker-compose.yml`
- [ ] **Verify** — `docker compose up --build`, create and delete an ACL, confirm `Cache invalidateAclCache` and `Cache invalidateAuthzDecision` log lines appear via consumer, not inline in `AclService`

## Open Questions

- Should `IAM_ACL_CHANGED` use the existing `IAM_CACHE_INVALIDATION` consumer group or a dedicated one? (Recommend reusing `IAM_CACHE_INVALIDATION` — it already exists and covers all cache-invalidation consumers.)
- Is there a race window concern (authz check hits cache between DB write and Kafka consumer fires)? Current `IAM_PERMISSION_CHANGED` flow has the same window — acceptable for this system.

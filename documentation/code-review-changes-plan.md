---
Plan

Fix all blocker + high + medium review items. Strategy: consolidate cache access through CacheService (no new cache class), reuse existing Kafka topics with a new IAM_USER_CHANGED consumer handler, add @AllowSelf metadata decorator for self-access, and make small targeted edits without moving files or restructuring modules.

Scope

In:
- Consolidate AuthorizationService to use only CacheService (remove raw cacheManager injection) — closes #1 and #8
- User deactivation: delete refresh tokens directly in UserService + add IAM_USER_CHANGED consumer for cache invalidation — closes #2 and #3
- JWT strategy: guard USER identity requires tenant_id — closes #4
- Add @AllowSelf(paramName) decorator + guard logic in IamPermissionGuard and SDK PermissionGuard, apply to getEffectivePermissions, getUserRoles, getOverrides — closes #9 and #10
- Expired-role cron: @Cron in AssignmentService to purge expired user_roles — closes #6
- Batch authz: @Max(100) on CheckAuthzBatchDto.checks — closes #7
- GET /acl and GET /roles pagination via page/limit query params — closes #11
- AuditService.onModuleDestroy: flush pending buffer before unsubscribe — closes #12
- Impersonation TTL from ConfigService (jwt.impersonationTtl) — closes #13
- AclService.createAcl: replace hardcoded FK constraint names with column-check on QueryFailedError — closes Minor-FK
- BaseService.update/remove: fix as unknown as FindOneOptions<T> cast — closes Minor-cast

Out:
- /authorization/check public access — intentional (pod-to-pod K8s)
- New Kafka topics
- Folder restructuring
- PermissionCacheService as a new file — CacheService already covers this; fix is removing the dual-injection anti-pattern

---
Action Items

[1] Consolidate cache in AuthorizationService
- Remove @Inject(CACHE_MANAGER) and cacheManager field
- Replace cacheManager.get(authzKey) → cacheService.get<boolean>(authzKey)
- Replace cacheManager.set(authzKey, allowed, 300000) → cacheService.set(authzKey, allowed, 300)
- File: src/modules/authorization/authorization.service.ts

[2] User deactivation — delete refresh tokens
- Inject @InjectRepository(RefreshTokenEntity) into UserService
- In setActivation(isActive=false): await refreshTokenRepo.delete({ user_id: id }) before emitting events
- File: src/modules/user/user.service.ts

[3] User deactivation — cache invalidation via existing IAM_USER_CHANGED
- Add @EventPattern(KAFKA_TOPICS.IAM_USER_CHANGED) handler in EventConsumer
- On receive: call cacheService.invalidateUserPermissionCache(tenant_id, user_id)
- File: src/event/event.consumer.ts

[4] JWT strategy — require tenant_id for USER identity
- In JwtStrategy.validate(): if identity_type === USER and no tenant_id → throw UnauthorizedException('Missing tenant context')
- File: src/modules/auth/strategies/jwt.strategy.ts

[5] Add @AllowSelf(paramName) decorator + guard self-check
- Create src/common/decorators/allow-self.decorator.ts: export const SELF_KEY = 'allowSelf'; export const AllowSelf = (param = 'userId') => SetMetadata(SELF_KEY, param)
- Mirror in packages/iam-sdk/src/decorators/allow-self.decorator.ts (export from index.ts)
- In IamPermissionGuard.canActivate(): before permission check, read SELF_KEY metadata; if set and user.sub === req.params[selfParam] → return true
- Same logic in SDK's PermissionGuard.canActivate()
- Apply @AllowSelf() to getEffectivePermissions, getUserRoles, getOverrides in assignment.controller.ts
- Files: src/common/decorators/, src/common/guards/iam-permission.guard.ts, packages/iam-sdk/src/decorators/, packages/iam-sdk/src/guards/permission.guard.ts, src/modules/rbac/assignment.controller.ts

[6] Expired-role cron cleanup
- Add @Cron(CronExpression.EVERY_HOUR) method in AssignmentService (or a thin RbacScheduler @Injectable in the same module)
- Runs: DELETE FROM user_roles WHERE expires_at IS NOT NULL AND expires_at < NOW()
- Import @nestjs/schedule, register ScheduleModule.forRoot() in AppModule
- Files: src/modules/rbac/assignment.service.ts, src/app.module.ts

[7] Batch authz limit + pagination for /acl and /roles
- CheckAuthzBatchDto: add @ArrayMaxSize(100) on checks field
- AclQueryDto: add optional page: number and limit: number fields; update AclService.findAllAcls() to pass .skip/.take
- RoleController.getRoles() and RoleService.findAllForTenant(): same pagination pattern
- Files: authorization/dto/check-authz-batch.dto.ts, acl/dto/acl-query.dto.ts, acl.service.ts, role.service.ts

[8] Audit buffer graceful flush on shutdown
- In AuditService.onModuleDestroy(): before subscription.unsubscribe(), call this.eventSubject.complete() and await a one-time flush via firstValueFrom(this.eventSubject.pipe(bufferTime(0), take(1))) or use a lastValueFrom drain pattern
- Simpler: expose flushPending() that calls await this.flushBatch(this.pendingBuffer) — switch to a manual buffer array instead of pure RxJS if needed
- File: src/modules/audit/audit.service.ts

[9] Impersonation TTL from config + minor fixes
- super-admin.service.ts:48: replace const accessTtl = 1800 with this.configService.get<number>('jwt.impersonationTtl', 1800)
- acl.service.ts:81-86: replace FK constraint name strings with (error as any).detail?.includes('user_id') pattern on error.code === '23503'
- base.service.ts:61,68: replace as unknown as FindOneOptions<T> with explicit typed helper: const opts: FindOneOptions<T> = { where: { id } as any }
- Files: super-admin.service.ts, acl.service.ts, base.service.ts

[10] Rebuild SDK dist and verify typecheck
- cd packages/iam-sdk && npm run build
- npx tsc --noEmit --project tsconfig.json (root)
- Fix any type errors from decorator changes

---
Open Questions

- Cron vs DB trigger for expired roles: @Cron is fine for MVP. Confirm acceptable if there's a sub-minute gap between expiry and cleanup.
- @AllowSelf param name: userId is the default for assignment routes. Confirm no other route param naming differs.
- flushPending audit drain: should we guarantee no audit loss on SIGTERM, or is best-effort acceptable (Kafka consumer can replay)?
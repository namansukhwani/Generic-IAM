# Agent Instructions

## Package Manager
Use **npm**: `npm install`, `npm run build`, `npm run test`

## Commit Attribution
AI commits MUST include:
```
Co-Authored-By: Antigravity <antigravity@deepmind.google.com>
```

## File-Scoped Commands
| Task | Command |
|------|---------|
| Typecheck | `npx tsc --noEmit --project tsconfig.json` |
| Lint | `npx eslint path/to/file.ts --fix` |
| Test | `npx jest path/to/file.spec.ts` |

## Key Conventions
- **Architecture**: Strict Clean Architecture (Domain > Application > Infrastructure).
- **Base Service**: Services inherit from `BaseService<T>` in `src/common/base/base.service.ts`.
- **Transactions**: `TenantTransactionInterceptor` handles DB transaction lifecycle and RLS isolation. Services use `@Inject(REQUEST) protected readonly request: RequestContext` and pass `request` to `super(defaultRepository, request)`.
- **Database**: PostgreSQL with Row-Level Security (RLS). Tenant creation bypasses RLS.
- **Events**: Emit audit/changed events to Kafka (e.g. `KAFKA_TOPICS.IAM_AUDIT`) using `eventProducer`.
- **Guards**: IAM modules use `IamPermissionGuard` and `IamAclGuard` (which call `AuthorizationService`). The SDK uses `PermissionGuard` and `AclGuard` (which call `IamAuthzService`). All guards support checking effective permissions and resource ACLs dynamically.
## Module Status
- `tenant`: CRUD implemented. Includes tenant-level audit log API.
- `user`: CRUD, status updates, user hierarchy query. Auto-assigns `MEMBER` role on creation. Batch role updates.
- `auth`: JWT strategy, cross-tenant login.
- `rbac`: Role CRUD, batch role-permission assignment via PATCH. Permissions use hierarchical dot notation (`code`) format.
- `acl`: Resource ACL CRUD.
- `authorization`: Centralized authz checks.
- `super-admin`: Impersonation, tenant management.
- `audit`: Kafka consumer, batch insertions, paginated query API.
- `sdk`: Thin read-only authz client. Use `npm link` for local dev.

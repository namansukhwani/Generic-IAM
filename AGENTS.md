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
- **Transactions**: Interceptor handles transactions. Services use `@Inject(REQUEST) protected readonly request: RequestContext` and pass `request` to `super(defaultRepository, request)`.
- **Database**: PostgreSQL with Row-Level Security (RLS). Tenant creation bypasses RLS.
- **Events**: Emit audit/changed events to Kafka (e.g. `KAFKA_TOPICS.IAM_AUDIT`) using `eventProducer`.

## Module Status
- `tenant`: CRUD implemented.
- `user`: CRUD, user hierarchy query.
- `auth`: JWT strategy, cross-tenant login.
- `rbac`: Role CRUD, permission assignment.
- `acl`: Resource ACL CRUD.
- `authorization`: Centralized authz checks.
- `super-admin`: Impersonation, tenant management.
- `audit`: Kafka consumer, batch insertions.
- `sdk`: Thin read-only authz client. Use `npm link` for local dev.

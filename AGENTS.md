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
- **Transactions**: Use `runInTransaction(dataSource, async (manager) => { ... })` from `src/common/utils/transaction.util.ts`.
- **Database**: PostgreSQL with Row-Level Security (RLS). Tenant creation bypasses RLS.
- **Events**: Emit audit/changed events to Kafka (e.g. `iam.audit`, `iam.user.changed`) *after* transactions commit.

## Module Status
- `tenant`: CRUD implemented. Creation configures tenant and admin user transactionally.
- `user`: CRUD, user hierarchy query (recursive CTE), status toggles implemented.
- `auth`: JWT strategy (Passport), cross-tenant login, hashed refresh tokens, token rotation implemented.
- `rbac`: Role CRUD, permission assignment, user role assignment, user permission overrides (GRANT/DENY), effective permission calculation implemented.
- `acl`: Resource ACL CRUD and Redis-cached permission checks implemented.
- `authorization`: Centralized authz checks (RBAC + ACL) with Redis caching and batching implemented.
- `super-admin`: Impersonation, tenant management (bypassing RLS), and audit log queries implemented.
- `audit`: Kafka consumer, batch insertions, and query logic implemented.

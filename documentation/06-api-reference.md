# IAM Service — API Reference

> **Version:** 1.0.0  
> **Status:** Approved for MVP  
> **Swagger UI:** `http://localhost:3000/api/docs`  
> **Related:** [DB Schema](./03-database-schema.md) | [Flows](./04-flows.md)

---

## Table of Contents

1. [API Conventions](#1-api-conventions)
2. [Authentication APIs](#2-authentication-apis)
3. [Tenant APIs](#3-tenant-apis)
4. [User Management APIs](#4-user-management-apis)
5. [RBAC APIs](#5-rbac-apis)
6. [ACL APIs](#6-acl-apis)
7. [Authorization Check API (S2S)](#7-authorization-check-api-s2s)
8. [SuperAdmin APIs](#8-superadmin-apis)
9. [Health & Observability APIs](#9-health--observability-apis)
10. [cURL Examples](#10-curl-examples)

---

## 1. API Conventions

- **Base URL:** `http://localhost:3000/api/v1`
- **Auth:** `Authorization: Bearer <access_token>` on all protected routes
- **Content-Type:** `application/json`

### Success Response Envelope

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-06-04T16:00:00Z",
    "correlation_id": "req-uuid"
  }
}
```

### Error Response Envelope

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions",
    "details": []
  },
  "meta": {
    "timestamp": "2026-06-04T16:00:00Z",
    "correlation_id": "req-uuid"
  }
}
```

### Common Error Codes

| HTTP | Code | Meaning |
|------|------|---------|
| 400 | `VALIDATION_ERROR` | Invalid request body |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Duplicate resource |
| 500 | `INTERNAL_ERROR` | Server error |

---

## 2. Authentication APIs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/auth/login` | User login (email + password) | No |
| `POST` | `/auth/refresh` | Refresh access token | No (uses refresh_token) |
| `POST` | `/auth/logout` | Revoke refresh tokens | Yes (User) |
| `GET` | `/auth/me` | Get current user profile | Yes (User) |

### `POST /auth/login`

**Request:**
```json
{
  "email": "user@acme.com",
  "password": "securePassword123"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2g...",
    "token_type": "Bearer",
    "expires_in": 900
  }
}
```

**Response 401 (invalid credentials):**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid email or password"
  }
}
```

### `POST /auth/refresh`

**Request:**
```json
{
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2g..."
}
```

**Response 200:** Same as `/auth/login` response.

### `POST /auth/logout`

**Headers:** `Authorization: Bearer <access_token>`  
**Response 200:**
```json
{
  "success": true,
  "data": { "message": "Logged out successfully" }
}
```

### `GET /auth/me`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "user@acme.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "tenant_id": "tenant-uuid",
    "is_active": true,
    "identity_type": "USER"
  }
}
```

---

## 3. Tenant APIs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/tenants` | Create a new tenant | SuperAdmin |
| `GET` | `/tenants` | List all tenants | SuperAdmin |
| `GET` | `/tenants/:id` | Get tenant details | SuperAdmin / Tenant_Admin |
| `PATCH` | `/tenants/:id` | Update tenant | SuperAdmin / Tenant_Admin |
| `DELETE` | `/tenants/:id` | Deactivate tenant | SuperAdmin |

### `POST /tenants`

**Request:**
```json
{
  "name": "Acme Corporation",
  "slug": "acme-corp",
  "settings": {
    "max_users": 1000,
    "features": ["expense", "payroll"]
  },
  "admin_email": "admin@acme.com",
  "admin_password": "initialPassword123"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "tenant-uuid",
    "name": "Acme Corporation",
    "slug": "acme-corp",
    "is_active": true,
    "settings": { "max_users": 1000, "features": ["expense", "payroll"] },
    "admin_user": {
      "id": "user-uuid",
      "email": "admin@acme.com"
    },
    "created_at": "2026-06-04T16:00:00Z"
  }
}
```

### `PATCH /tenants/:id`

**Request:**
```json
{
  "name": "Acme Corp Updated",
  "settings": { "max_users": 2000 }
}
```

**Response 200:** Updated tenant object.

---

## 4. User Management APIs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/users` | Create user in current tenant | Tenant_Admin |
| `GET` | `/users` | List users in current tenant | Tenant_Admin |
| `GET` | `/users/:id` | Get user details | Tenant_Admin / Self |
| `PATCH` | `/users/:id` | Update user | Tenant_Admin / Self (limited) |
| `PATCH` | `/users/:id/activate` | Activate user | Tenant_Admin |
| `PATCH` | `/users/:id/deactivate` | Deactivate user | Tenant_Admin |
| `GET` | `/users/:id/hierarchy` | Get user's reporting chain | Tenant_Admin |

### `POST /users`

**Request:**
```json
{
  "email": "jane@acme.com",
  "password": "securePassword",
  "first_name": "Jane",
  "last_name": "Doe",
  "manager_id": "manager-user-uuid"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "new-user-uuid",
    "email": "jane@acme.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "manager_id": "manager-user-uuid",
    "is_active": true,
    "tenant_id": "tenant-uuid",
    "created_at": "2026-06-04T16:00:00Z"
  }
}
```

### `GET /users`

**Query params:** `?page=1&limit=20&search=jane`

**Response 200:**
```json
{
  "success": true,
  "data": [
    { "id": "user-1", "email": "jane@acme.com", "first_name": "Jane", ... }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20
  }
}
```

---

## 5. RBAC APIs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/roles` | Create custom role | Tenant_Admin |
| `GET` | `/roles` | List roles (system + custom) | Tenant_Admin |
| `GET` | `/roles/:id` | Get role with permissions | Tenant_Admin |
| `PATCH` | `/roles/:id` | Update custom role | Tenant_Admin |
| `DELETE` | `/roles/:id` | Delete custom role | Tenant_Admin |
| `PATCH` | `/roles/:id/permissions` | Batch assign permissions to role | Tenant_Admin |
| `DELETE` | `/roles/:id/permissions/:permissionId` | Remove permission from role | Tenant_Admin |
| `GET` | `/permissions` | List all available permissions | Tenant_Admin |
| `POST` | `/users/:id/roles` | Assign role to user | Tenant_Admin |
| `DELETE` | `/users/:id/roles/:roleId` | Remove role from user | Tenant_Admin |
| `GET` | `/users/:id/roles` | List user's roles | Tenant_Admin / Self |
| `GET` | `/users/:id/effective-permissions` | Get computed effective permissions | Tenant_Admin / Self |
| `POST` | `/users/:id/permission-overrides` | Add GRANT/DENY override | Tenant_Admin |
| `GET` | `/users/:id/permission-overrides` | List user's overrides | Tenant_Admin / Self |
| `DELETE` | `/users/:id/permission-overrides/:overrideId` | Remove override | Tenant_Admin |

### `POST /roles`

**Request:**
```json
{
  "name": "Custom_Finance_Role",
  "description": "Custom role for finance team",
  "permissions": [
    "expense:read",
    "invoice:read",
    "report:read"
  ]
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "role-uuid",
    "name": "Custom_Finance_Role",
    "is_system": false,
    "tenant_id": "tenant-uuid",
    "permissions": [...]
  }
}
```

### `PATCH /roles/:id/permissions`

**Request (batch assign):**
```json
{
  "permission_ids": ["perm-uuid-1", "perm-uuid-2", "perm-uuid-3"]
}
```

### `POST /users/:id/roles`

**Request:**
```json
{
  "role_id": "role-uuid",
  "expires_at": "2026-12-31T23:59:59Z"
}
```

### `POST /users/:id/permission-overrides`

**Request (DENY — subtract permission):**
```json
{
  "permission_id": "perm-expense-delete-uuid",
  "override_type": "DENY",
  "reason": "Restricted per HR policy — no expense deletion"
}
```

**Request (GRANT — add permission):**
```json
{
  "permission_id": "perm-report-export-uuid",
  "override_type": "GRANT",
  "reason": "Temporary access for Q2 audit"
}
```

### `GET /users/:id/effective-permissions`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user_id": "user-uuid",
    "roles": [
      { "id": "role-1", "name": "EXPENSE_MANAGER", "is_system": true }
    ],
    "role_permissions": ["expense:read", "expense:write", "expense:delete", "expense:approve"],
    "overrides": [
      { "permission": "expense:delete", "type": "DENY", "reason": "HR policy" },
      { "permission": "report:read", "type": "GRANT", "reason": "Q2 audit" }
    ],
    "effective_permissions": ["expense:read", "expense:write", "expense:approve", "report:read"]
  }
}
```

---

## 6. ACL APIs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/acl` | Create resource ACL | Tenant_Admin |
| `GET` | `/acl` | List ACLs (filterable) | Tenant_Admin |
| `DELETE` | `/acl/:id` | Delete ACL entry | Tenant_Admin |
| `POST` | `/acl/check` | Check resource-level access | Internal / Service |

### `POST /acl`

**Request:**
```json
{
  "user_id": "user-uuid",
  "resource_type": "expense",
  "resource_id": "expense-uuid",
  "permission": "approve"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "acl-uuid",
    "user_id": "user-uuid",
    "resource_type": "expense",
    "resource_id": "expense-uuid",
    "permission": "approve",
    "granted_by": "admin-uuid",
    "created_at": "2026-06-04T16:00:00Z"
  }
}
```

### `POST /acl/check`

**Request:**
```json
{
  "user_id": "user-uuid",
  "tenant_id": "tenant-uuid",
  "resource_type": "expense",
  "resource_id": "expense-uuid",
  "permission": "approve"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "allowed": true,
    "source": "acl",
    "evaluated_at": "2026-06-04T16:00:00Z"
  }
}
```

---

## 7. Authorization Check API (S2S)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/authorization/check` | Centralized authz check | Service (User JWT) |
| `POST` | `/authorization/check-batch` | Batch authz check | Service (User JWT) |

### `POST /authorization/check`

**Request:**
```json
{
  "user_id": "user-uuid",
  "tenant_id": "tenant-uuid",
  "permission": "expense:write",
  "resource_type": "expense",
  "resource_id": "expense-123"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "allowed": true,
    "source": "rbac",
    "permission": "expense:write",
    "evaluated_at": "2026-06-04T16:00:00Z"
  }
}
```

### `POST /authorization/check-batch`

**Request:**
```json
{
  "user_id": "user-uuid",
  "tenant_id": "tenant-uuid",
  "checks": [
    { "permission": "expense:read" },
    { "permission": "expense:write" },
    { "permission": "expense:approve", "resource_type": "expense", "resource_id": "exp-123" }
  ]
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "results": [
      { "permission": "expense:read", "allowed": true, "source": "rbac" },
      { "permission": "expense:write", "allowed": true, "source": "rbac" },
      { "permission": "expense:approve", "allowed": false, "source": null }
    ],
    "evaluated_at": "2026-06-04T16:00:00Z"
  }
}
```

---

## 8. SuperAdmin APIs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/super-admin/impersonate` | Impersonate a user | SuperAdmin |
| `GET` | `/super-admin/tenants` | List all tenants with stats | SuperAdmin |
| `GET` | `/super-admin/tenants/:id/users` | List tenant's users | SuperAdmin |
| `GET` | `/super-admin/audit-logs` | Query global audit logs | SuperAdmin |

### `POST /super-admin/impersonate`

**Request:**
```json
{
  "user_id": "target-user-uuid",
  "tenant_id": "target-tenant-uuid",
  "reason": "Support ticket #12345"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "Bearer",
    "expires_in": 1800,
    "identity_type": "IMPERSONATION",
    "impersonating": {
      "user_id": "target-user-uuid",
      "tenant_id": "target-tenant-uuid"
    }
  }
}
```

### `GET /super-admin/audit-logs`

**Query params:** `?tenant_id=<uuid>&actor_id=<uuid>&action=AUTH_LOGIN_SUCCESS&from=2026-01-01&to=2026-06-04&page=1&limit=50`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "log-uuid",
      "actor_id": "user-uuid",
      "actor_type": "USER",
      "action": "AUTH_LOGIN_SUCCESS",
      "tenant_id": "tenant-uuid",
      "ip_address": "192.168.1.1",
      "correlation_id": "req-uuid",
      "created_at": "2026-06-04T16:00:00Z"
    }
  ],
  "meta": { "total": 1234, "page": 1, "limit": 50 }
}
```

---

## 9. Health & Observability APIs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/health` | Basic health check | No |
| `GET` | `/health/ready` | Readiness check (DB, Redis, Kafka) | No |
| `GET` | `/health/live` | Liveness probe | No |

### `GET /health/ready`

**Response 200:**
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "kafka": { "status": "up" }
  }
}
```

---

## 10. cURL Examples

### Login

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@acme.com", "password": "password123"}'
```

### Create a Tenant (SuperAdmin)

```bash
SA_TOKEN="<superadmin-access-token>"

curl -X POST http://localhost:3000/api/v1/tenants \
  -H "Authorization: Bearer $SA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "slug": "acme-corp",
    "admin_email": "admin@acme.com",
    "admin_password": "admin123"
  }'
```

### Create a User (Tenant Admin)

```bash
TOKEN="<tenant-admin-access-token>"

curl -X POST http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane@acme.com",
    "password": "securePass",
    "first_name": "Jane",
    "last_name": "Doe"
  }'
```

### Assign a Role to a User

```bash
curl -X POST http://localhost:3000/api/v1/users/<user-id>/roles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role_id": "<role-id>", "expires_at": null}'
```

### Add a Permission Override (DENY)

```bash
curl -X POST http://localhost:3000/api/v1/users/<user-id>/permission-overrides \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"permission_id": "<perm-id>", "override_type": "DENY", "reason": "HR policy"}'
```

### Get Effective Permissions

```bash
curl http://localhost:3000/api/v1/users/<user-id>/effective-permissions \
  -H "Authorization: Bearer $TOKEN"
```

### Create a Resource ACL

```bash
curl -X POST http://localhost:3000/api/v1/acl \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "<user-id>",
    "resource_type": "expense",
    "resource_id": "<expense-id>",
    "permission": "approve"
  }'
```

### Authorization Check (S2S)

```bash
# Forward the user JWT from the calling service
curl -X POST http://localhost:3000/api/v1/authorization/check \
  -H "Authorization: Bearer <user-jwt>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "<user-id>",
    "tenant_id": "<tenant-id>",
    "permission": "expense:write"
  }'
```

### Impersonate a User (SuperAdmin)

```bash
curl -X POST http://localhost:3000/api/v1/super-admin/impersonate \
  -H "Authorization: Bearer $SA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "<target-user-id>",
    "tenant_id": "<tenant-id>",
    "reason": "Support ticket #12345"
  }'
```

### Refresh Token

```bash
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "<refresh-token>"}'
```

### Logout

```bash
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H "Authorization: Bearer $TOKEN"
```

---

> **Related Documents:**
> - [03-database-schema.md](./03-database-schema.md) — Entity schemas for request/response bodies
> - [04-flows.md](./04-flows.md) — Sequence flows for each API domain
> - Swagger UI at `http://localhost:3000/api/docs` for interactive exploration

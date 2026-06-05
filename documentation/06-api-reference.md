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
**Response 204:** No content

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
  "admin": {
    "email": "admin@acme.com",
    "password": "initialPassword123",
    "first_name": "Admin",
    "last_name": "User"
  }
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
| `PATCH` | `/users/:id/status` | Update user status (activate/deactivate) | Tenant_Admin |
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
| `GET` | `/permissions` | List all available permissions | Tenant_Admin |
| `PATCH` | `/roles/:id/permissions` | Batch add/remove permissions from role | Tenant_Admin |
| `PATCH` | `/users/:id/roles` | Batch assign/remove roles for user | Tenant_Admin |
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
  "description": "Custom role for finance team"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "role-uuid",
    "name": "Custom_Finance_Role",
    "description": "Custom role for finance team",
    "is_system": false,
    "tenant_id": "tenant-uuid",
    "created_at": "2026-06-04T16:00:00Z"
  }
}
```

### `PATCH /roles/:id/permissions`

**Request (batch add/remove):**
```json
{
  "add": ["perm-uuid-1", "perm-uuid-2"],
  "remove": ["perm-uuid-3"]
}
```

**Response 200:**
```json
{
  "success": true
}
```

### `GET /permissions`

**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "perm-uuid-1",
      "code": "expense:read",
      "description": "Read expense records",
      "is_system": true,
      "created_at": "2026-06-04T16:00:00Z"
    }
  ]
}
```

### `PATCH /users/:id/roles`

**Request (batch assign/remove):**
```json
{
  "add": [
    { "role_id": "role-uuid-1", "expires_at": "2026-12-31T23:59:59Z" },
    { "role_id": "role-uuid-2" }
  ],
  "remove": ["role-uuid-3"]
}
```

**Response 200:**
```json
{
  "success": true
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

> Paste the **Setup** block once in your terminal, then run any command individually. Sections below mirror the document order — every endpoint in the API tables has a corresponding curl. Replace tokens with real values from `/auth/login` when testing against a live server.

### Setup (run once)

```bash
BASE="http://localhost:3000/api/v1"
HEALTH="http://localhost:3000/api/health"

# Tokens
SA_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJlbWFpbCI6InN1cGVyYWRtaW5AaWFtLmludGVybmFsIiwicm9sZSI6IlNVUEVSX0FETUlOIiwiaWF0IjoxNzQ5MDUyODAwfQ.xK9mP2vL8nQrT5sW1uYzBcDeFgHiJkLmNoPqRsTuV"
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YmE3YjgxMC05ZGFkLTExZDEtODBiNC0wMGMwNGZkNDMwYzgiLCJlbWFpbCI6ImFkbWluQGFjbWUuY29tIiwicm9sZSI6IlRFTkFOVF9BRE1JTiIsInRlbmFudElkIjoiZjQ3YWMxMGItNThjYy00MzcyLWE1NjctMGUwMmIyYzNkNDc5IiwiaWF0IjoxNzQ5MDUyODAwfQ.mR4nK7pX2wVt6qL9sA1bCdEfGhIjKlMnOpQrStUvW"

# UUIDs — match seeded data or values returned by prior API calls
TENANT_ID="f47ac10b-58cc-4372-a567-0e02b2c3d479"
ADMIN_USER_ID="550e8400-e29b-41d4-a716-446655440000"
JANE_USER_ID="6ba7b810-9dad-11d1-80b4-00c04fd430c8"
FINANCE_ROLE_ID="d4e5f6a7-b8c9-0123-defa-234567890123"
VIEWER_ROLE_ID="a7b8c9d0-e1f2-3456-abcd-567890123456"
PERM_EXPENSE_READ="e5f6a7b8-c9d0-1234-efab-345678901234"
PERM_EXPENSE_WRITE="f6a7b8c9-d0e1-2345-fabc-456789012345"
PERM_EXPENSE_DELETE="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
EXPENSE_ID="b8c9d0e1-f2a3-4567-bcde-678901234567"
ACL_ID="d0e1f2a3-b4c5-6789-defa-890123456789"
OVERRIDE_ID="c9d0e1f2-a3b4-5678-cdef-789012345678"
REFRESH_TOKEN="dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4gZm9yIHRlc3RpbmcgcHVycG9zZXMgb25seQ"
```

---

### 2. Authentication APIs

#### POST /auth/login

```bash
curl -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@acme.com",
    "password": "Admin@acme123"
  }'
```

#### POST /auth/refresh

```bash
curl -X POST $BASE/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\": \"$REFRESH_TOKEN\"}"
```

#### POST /auth/logout

```bash
curl -X POST $BASE/auth/logout \
  -H "Authorization: Bearer $TOKEN"
# Response: 204 No Content
```

#### GET /auth/me

```bash
curl $BASE/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

---

### 3. Tenant APIs

#### POST /tenants

```bash
curl -X POST $BASE/tenants \
  -H "Authorization: Bearer $SA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "slug": "acme-corp",
    "settings": {
      "max_users": 1000,
      "features": ["expense", "payroll"]
    },
    "admin": {
      "email": "admin@acme.com",
      "password": "Admin@acme123",
      "first_name": "Admin",
      "last_name": "User"
    }
  }'
```

#### GET /tenants

```bash
curl $BASE/tenants \
  -H "Authorization: Bearer $SA_TOKEN"
```

#### GET /tenants/:id

```bash
curl $BASE/tenants/$TENANT_ID \
  -H "Authorization: Bearer $SA_TOKEN"
```

#### PATCH /tenants/:id

```bash
curl -X PATCH $BASE/tenants/$TENANT_ID \
  -H "Authorization: Bearer $SA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation (Updated)",
    "settings": { "max_users": 2000 }
  }'
```

#### DELETE /tenants/:id

```bash
curl -X DELETE $BASE/tenants/$TENANT_ID \
  -H "Authorization: Bearer $SA_TOKEN"
# Response: 204 No Content — tenant is soft-deactivated
```

---

### 4. User Management APIs

#### POST /users

```bash
curl -X POST $BASE/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane.doe@acme.com",
    "password": "Jane@acme456",
    "first_name": "Jane",
    "last_name": "Doe",
    "manager_id": "'$ADMIN_USER_ID'"
  }'
```

#### GET /users

```bash
curl "$BASE/users?page=1&limit=20&search=jane" \
  -H "Authorization: Bearer $TOKEN"
```

#### GET /users/:id

```bash
curl $BASE/users/$JANE_USER_ID \
  -H "Authorization: Bearer $TOKEN"
```

#### PATCH /users/:id

```bash
curl -X PATCH $BASE/users/$JANE_USER_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jane",
    "last_name": "Smith",
    "manager_id": "'$ADMIN_USER_ID'"
  }'
```

#### PATCH /users/:id/status

```bash
curl -X PATCH $BASE/users/$JANE_USER_ID/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_active": false}'
```

#### GET /users/:id/hierarchy

```bash
curl $BASE/users/$JANE_USER_ID/hierarchy \
  -H "Authorization: Bearer $TOKEN"
```

---

### 5. RBAC APIs

#### GET /permissions

```bash
curl $BASE/permissions \
  -H "Authorization: Bearer $TOKEN"
```

#### POST /roles

```bash
curl -X POST $BASE/roles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Custom_Finance_Role",
    "description": "Custom role for the finance team — read/write on expenses"
  }'
```

#### GET /roles

```bash
curl $BASE/roles \
  -H "Authorization: Bearer $TOKEN"
```

#### GET /roles/:id

```bash
curl $BASE/roles/$FINANCE_ROLE_ID \
  -H "Authorization: Bearer $TOKEN"
```

#### PATCH /roles/:id

```bash
curl -X PATCH $BASE/roles/$FINANCE_ROLE_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Custom_Finance_Role_V2",
    "description": "Updated finance role with extended expense access"
  }'
```

#### DELETE /roles/:id

```bash
curl -X DELETE $BASE/roles/$FINANCE_ROLE_ID \
  -H "Authorization: Bearer $TOKEN"
# Response: 204 No Content — only custom (non-system) roles can be deleted
```

#### PATCH /roles/:id/permissions

```bash
curl -X PATCH $BASE/roles/$FINANCE_ROLE_ID/permissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "add": ["'$PERM_EXPENSE_READ'", "'$PERM_EXPENSE_WRITE'"],
    "remove": ["'$PERM_EXPENSE_DELETE'"]
  }'
```

#### PATCH /users/:id/roles

```bash
curl -X PATCH $BASE/users/$JANE_USER_ID/roles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "add": [
      { "role_id": "'$FINANCE_ROLE_ID'", "expires_at": "2026-12-31T23:59:59Z" },
      { "role_id": "'$VIEWER_ROLE_ID'" }
    ],
    "remove": []
  }'
```

#### GET /users/:id/roles

```bash
curl $BASE/users/$JANE_USER_ID/roles \
  -H "Authorization: Bearer $TOKEN"
```

#### GET /users/:id/effective-permissions

```bash
curl $BASE/users/$JANE_USER_ID/effective-permissions \
  -H "Authorization: Bearer $TOKEN"
```

#### POST /users/:id/permission-overrides (DENY)

```bash
curl -X POST $BASE/users/$JANE_USER_ID/permission-overrides \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "permission_id": "'$PERM_EXPENSE_DELETE'",
    "override_type": "DENY",
    "reason": "Restricted per HR policy — no expense deletion allowed"
  }'
```

#### POST /users/:id/permission-overrides (GRANT)

```bash
curl -X POST $BASE/users/$JANE_USER_ID/permission-overrides \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "permission_id": "'$PERM_EXPENSE_WRITE'",
    "override_type": "GRANT",
    "reason": "Temporary access granted for Q2 audit review"
  }'
```

#### GET /users/:id/permission-overrides

```bash
curl $BASE/users/$JANE_USER_ID/permission-overrides \
  -H "Authorization: Bearer $TOKEN"
```

#### DELETE /users/:id/permission-overrides/:overrideId

```bash
curl -X DELETE $BASE/users/$JANE_USER_ID/permission-overrides/$OVERRIDE_ID \
  -H "Authorization: Bearer $TOKEN"
# Response: 204 No Content
```

---

### 6. ACL APIs

#### POST /acl

```bash
curl -X POST $BASE/acl \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'$JANE_USER_ID'",
    "resource_type": "expense",
    "resource_id": "'$EXPENSE_ID'",
    "permission": "approve"
  }'
```

#### GET /acl

```bash
curl "$BASE/acl?resource_type=expense&resource_id=$EXPENSE_ID" \
  -H "Authorization: Bearer $TOKEN"
```

#### DELETE /acl/:id

```bash
curl -X DELETE $BASE/acl/$ACL_ID \
  -H "Authorization: Bearer $TOKEN"
# Response: 204 No Content
```

#### POST /acl/check

```bash
curl -X POST $BASE/acl/check \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'$JANE_USER_ID'",
    "tenant_id": "'$TENANT_ID'",
    "resource_type": "expense",
    "resource_id": "'$EXPENSE_ID'",
    "permission": "approve"
  }'
```

---

### 7. Authorization Check API (S2S)

#### POST /authorization/check

```bash
curl -X POST $BASE/authorization/check \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'$JANE_USER_ID'",
    "tenant_id": "'$TENANT_ID'",
    "permission": "expense:write",
    "resource_type": "expense",
    "resource_id": "'$EXPENSE_ID'"
  }'
```

#### POST /authorization/check-batch

```bash
curl -X POST $BASE/authorization/check-batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'$JANE_USER_ID'",
    "tenant_id": "'$TENANT_ID'",
    "checks": [
      { "permission": "expense:read" },
      { "permission": "expense:write" },
      { "permission": "expense:approve", "resource_type": "expense", "resource_id": "'$EXPENSE_ID'" }
    ]
  }'
```

---

### 8. SuperAdmin APIs

#### GET /super-admin/tenants

```bash
curl "$BASE/super-admin/tenants?page=1&limit=20" \
  -H "Authorization: Bearer $SA_TOKEN"
```

#### GET /super-admin/tenants/:id/users

```bash
curl "$BASE/super-admin/tenants/$TENANT_ID/users?page=1&limit=20" \
  -H "Authorization: Bearer $SA_TOKEN"
```

#### GET /super-admin/audit-logs

```bash
curl "$BASE/super-admin/audit-logs?tenant_id=$TENANT_ID&action=AUTH_LOGIN_SUCCESS&from=2026-01-01&to=2026-12-31&page=1&limit=50" \
  -H "Authorization: Bearer $SA_TOKEN"
```

#### POST /super-admin/impersonate

```bash
curl -X POST $BASE/super-admin/impersonate \
  -H "Authorization: Bearer $SA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "'$JANE_USER_ID'",
    "tenant_id": "'$TENANT_ID'",
    "reason": "Support ticket #78901 — verifying expense approval flow"
  }'
```

---

### 9. Health & Observability APIs

#### GET /health

```bash
curl $HEALTH
```

#### GET /health/ready

```bash
curl $HEALTH/ready
```

#### GET /health/live

```bash
curl $HEALTH/live
```

---

> **Related Documents:**
> - [03-database-schema.md](./03-database-schema.md) — Entity schemas for request/response bodies
> - [04-flows.md](./04-flows.md) — Sequence flows for each API domain
> - Swagger UI at `http://localhost:3000/api/docs` for interactive exploration

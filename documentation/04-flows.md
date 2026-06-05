# IAM Service — Authentication, Authorization & Flow Diagrams

> **Version:** 1.0.0  
> **Status:** Approved for MVP  
> **Related:** [Architecture](./02-architecture.md) | [DB Schema](./03-database-schema.md) | [API Reference](./06-api-reference.md) | [Strategies](./05-strategies.md)

---

## Flow Index

| # | Flow | Diagram Type | Section |
|---|------|-------------|---------|
| 1 | User Login | Sequence | [§1.2](#12-user-login-flow) |
| 2 | Token Refresh | Sequence | [§1.3](#13-token-refresh-flow) |
| 3 | Logout | Sequence | [§1.4](#14-logout-flow) |
| 4 | Authorization Decision | Flowchart | [§2.1](#21-authorization-decision-flow) |
| 5 | Permission Hierarchy | Text diagram | [§2.2](#22-permission-hierarchy) |
| 6 | Microservice AuthZ (SDK) | Sequence | [§2.3](#23-microservice-authorization-via-sdk) |
| 7 | Cache Invalidation | Sequence | [§3.1](#31-cache-invalidation-flow) |
| 8 | Tenant Isolation | Sequence | [§4.1](#41-tenant-isolation-flow) |
| 9 | Cross-Service AuthZ Check | Sequence | [§5.1](#51-cross-service-authorization-check) |
| 10 | Async Kafka Flow | Sequence | [§5.2](#52-async-kafka-flow) |
| 11 | Impersonation | Sequence | [§6.1](#61-impersonation-flow) |
| 12 | Audit Pipeline | Flowchart | [§7.1](#71-audit-pipeline) |

---

## Table of Contents

1. [Authentication Flows](#1-authentication-flows)
2. [Authorization Flows](#2-authorization-flows)
3. [Cache Invalidation Flow](#3-cache-invalidation-flow)
4. [Multi-Tenant Isolation Flow](#4-multi-tenant-isolation-flow)
5. [Service-to-Service Communication Flows](#5-service-to-service-communication-flows)
6. [SuperAdmin & Impersonation Flow](#6-superadmin--impersonation-flow)
7. [Audit Flow](#7-audit-flow)

---

## 1. Authentication Flows

### 1.1 Identity Types

| Type | Description | Token Claims | Use Case |
|------|-------------|-------------|----------|
| `USER` | Human user within a tenant | user_id, tenant_id, identity_type | Normal user operations |
| `SUPER_ADMIN` | Global administrator | user_id, identity_type (no tenant_id) | Cross-tenant operations |
| `IMPERSONATION` | SuperAdmin acting as user | user_id, tenant_id, impersonator_id, identity_type | Support/debugging |

> **Note:** No `SERVICE` identity type. All microservices run in the same K8s cluster and forward the user's JWT. K8s NetworkPolicies enforce which pods can communicate.

### JWT Token Structures

**Access Token Payload:**
```json
{
  "sub": "user-uuid",
  "tenant_id": "tenant-uuid",
  "identity_type": "USER",
  "iat": 1700000000,
  "exp": 1700000900
}
```

**SuperAdmin Token Payload:**
```json
{
  "sub": "superadmin-uuid",
  "identity_type": "SUPER_ADMIN",
  "iat": 1700000000,
  "exp": 1700000900
}
```

**Impersonation Token Payload:**
```json
{
  "sub": "target-user-uuid",
  "tenant_id": "target-tenant-uuid",
  "identity_type": "IMPERSONATION",
  "impersonator_id": "superadmin-uuid",
  "iat": 1700000000,
  "exp": 1700001800
}
```

### 1.2 User Login Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant AC as AuthController
    participant AS as AuthService
    participant DB as PostgreSQL
    participant R as Redis
    participant K as Kafka

    C->>AC: POST /auth/login {email, password}
    AC->>AS: login(dto)
    AS->>DB: Find user by email (no tenant context — login is cross-tenant)
    DB-->>AS: User record
    AS->>AS: Verify bcrypt hash
    alt Invalid Credentials
        AS-->>AC: 401 Unauthorized
        AS->>K: Emit AUTH_FAILED event
        AC-->>C: 401 {error: "Invalid credentials"}
    else Valid Credentials
        AS->>AS: Check user.is_active
        alt User Inactive
            AS-->>AC: 403 Forbidden
            AC-->>C: 403 {error: "Account deactivated"}
        else Active
            AS->>AS: Generate access token (JWT, 15min)
            AS->>DB: Create refresh token record (7d)
            AS->>K: Emit AUTH_SUCCESS event
            AS-->>AC: TokenResponse
            AC-->>C: 200 {access_token, refresh_token, expires_in}
        end
    end
```

### 1.3 Token Refresh Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant AC as AuthController
    participant AS as AuthService
    participant DB as PostgreSQL

    C->>AC: POST /auth/refresh {refresh_token}
    AC->>AS: refresh(dto)
    AS->>DB: Find refresh token
    alt Token Not Found or Expired
        AS-->>AC: 401 Unauthorized
        AC-->>C: 401 {error: "Invalid refresh token"}
    else Valid
        AS->>DB: Delete old refresh token (rotation)
        AS->>AS: Generate new access token
        AS->>DB: Create new refresh token
        AS-->>AC: TokenResponse
        AC-->>C: 200 {access_token, refresh_token, expires_in}
    end
```

### 1.4 Logout Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant AC as AuthController
    participant AS as AuthService
    participant DB as PostgreSQL
    participant R as Redis
    participant K as Kafka

    C->>AC: POST /auth/logout (JWT in header)
    AC->>AS: logout(userId)
    AS->>DB: Delete all refresh tokens for user
    AS->>R: Invalidate permission cache
    AS->>K: Emit AUTH_LOGOUT event
    AS-->>AC: Success
    AC-->>C: 200 {message: "Logged out"}
```

> **Note:** Access tokens are stateless JWTs and cannot be individually revoked. They expire naturally (15min). For immediate revocation, a token blacklist in Redis can be added post-MVP.

---

## 2. Authorization Flows

### 2.1 Authorization Decision Flow

```mermaid
flowchart TD
    A["Incoming Request"] --> B["AuthGuard: Validate JWT"]
    B -->|Invalid| C["401 Unauthorized"]
    B -->|Valid| D["Extract User Context"]
    D --> E{"Identity Type?"}
    
    E -->|SUPER_ADMIN| F["Bypass All Checks → ALLOW"]
    E -->|USER / IMPERSONATION| H["PermissionGuard"]
    
    H --> I["Check Redis Cache"]
    I -->|Hit| J["Permission Set"]
    I -->|Miss| K["Query DB: user_roles → role_permissions → permissions"]
    K --> L["Cache in Redis (TTL: 5min)"]
    L --> J
    
    J --> M{"RBAC Grants Permission?"}
    M -->|Yes| N["ALLOW"]
    M -->|No| O{"ACL Check Required?"}
    
    O -->|No| P["403 Forbidden"]
    O -->|Yes| Q["Query resource_acls for (user, resource_type, resource_id)"]
    Q --> R{"ACL Grants Permission?"}
    R -->|Yes| N
    R -->|No| P
```

### 2.2 Permission Hierarchy

Permissions follow the pattern `resource:action`. Wildcards enable hierarchical inheritance.

```
Permission Hierarchy:
    *:*                    ← SuperAdmin (all resources, all actions)
    ├── expense:*          ← All expense actions
    │   ├── expense:read
    │   ├── expense:write
    │   ├── expense:delete
    │   └── expense:approve
    ├── payroll:*           ← All payroll actions
    │   ├── payroll:read
    │   └── payroll:write
    ├── user:*              ← All user management actions
    │   ├── user:read
    │   ├── user:write
    │   └── user:delete
    └── role:*              ← All role management actions
        ├── role:read
        ├── role:write
        └── role:assign
```

**Permission Matching Algorithm (with GRANT/DENY overrides):**

```typescript
function computeEffectivePermissions(
  rolePermissions: Set<string>,    // Union of all assigned role permissions
  userGrants: Set<string>,         // User-level GRANT overrides
  userDenies: Set<string>          // User-level DENY overrides
): Set<string> {
  // Step 1: Start with role permissions
  const effective = new Set(rolePermissions);
  
  // Step 2: Add user-level GRANTs
  userGrants.forEach(p => effective.add(p));
  
  // Step 3: Remove user-level DENYs (DENY always wins)
  userDenies.forEach(p => effective.delete(p));
  
  return effective;
}

function hasPermission(
  effectivePermissions: Set<string>, 
  required: string
): boolean {
  // Direct match
  if (effectivePermissions.has(required)) return true;
  
  // Wildcard: *:* grants everything
  if (effectivePermissions.has('*:*')) return true;
  
  // Resource wildcard: expense:* grants expense:read
  const [resource, action] = required.split(':');
  if (effectivePermissions.has(`${resource}:*`)) return true;
  
  return false;
}
```

### 2.3 Microservice Authorization via SDK

```mermaid
sequenceDiagram
    participant U as User
    participant EXP as Expense Service
    participant SDK as IAM SDK (in-process)
    participant R as Redis (Shared)
    participant IAM as IAM Service
    participant K as Kafka

    U->>EXP: DELETE /expenses/123 (User JWT)
    EXP->>SDK: PermissionGuard: check 'expense:delete'
    SDK->>SDK: Validate JWT locally (shared signing key)
    SDK->>R: GET perms:{tenant_id}:{user_id}
    alt Cache Hit
        R-->>SDK: Effective permission set
        SDK->>SDK: hasPermission('expense:delete') → true
    else Cache Miss
        SDK->>IAM: POST /authorization/check {user_id, tenant_id, permission}
        Note over SDK,IAM: Forwards user JWT in Authorization header (trusted K8s network)
        IAM-->>SDK: {allowed: true, permissions: [...], source: 'rbac'}
        SDK->>R: SET perms:{tenant_id}:{user_id} (TTL: 5min)
    end
    SDK->>SDK: AclGuard: check ACL for expense:123
    SDK->>R: GET acl:{tenant_id}:{user_id}:expense:123
    alt ACL Cache Hit
        R-->>SDK: ACL entry
    else ACL Cache Miss
        SDK->>IAM: POST /acl/check {user_id, resource_type, resource_id}
        IAM-->>SDK: {allowed: true}
        SDK->>R: Cache ACL result
    end
    SDK-->>EXP: ALLOW
    EXP->>EXP: Delete expense 123
    EXP-->>U: 200 OK

    Note over K,R: Kafka invalidation events
    K->>SDK: ROLE_CHANGED {tenant_id, user_id}
    SDK->>R: DELETE perms:{tenant_id}:{user_id}
```

### 2.4 Predefined System Roles

| Role | Scope | Permissions | Notes |
|------|-------|-------------|-------|
| `SUPER_ADMIN` | Global | `*:*` | Seeded at bootstrap. Not tenant-bound. |
| `TENANT_ADMIN` | Tenant | `user:*`, `role:*`, `acl:*`, `tenant:read`, `tenant:write` | Full tenant management |
| `TENANT_USER` | Tenant | `user:read` (self only) | Base role for all users |
| `EXPENSE_MANAGER` | Tenant | `expense:read`, `expense:write`, `expense:delete`, `expense:approve` | Full expense management |
| `EXPENSE_VIEWER` | Tenant | `expense:read` | Read-only expense access |
| `EXPENSE_APPROVER` | Tenant | `expense:read`, `expense:approve` | Approve but not create/delete |
| `PAYROLL_MANAGER` | Tenant | `payroll:read`, `payroll:write`, `payroll:approve` | Full payroll management |
| `PAYROLL_VIEWER` | Tenant | `payroll:read` | Read-only payroll access |
| `INVOICE_MANAGER` | Tenant | `invoice:read`, `invoice:write`, `invoice:delete`, `invoice:approve` | Full invoice management |
| `INVOICE_VIEWER` | Tenant | `invoice:read` | Read-only invoice access |
| `REPORT_VIEWER` | Tenant | `report:read` | Read-only reports |
| `REPORT_MANAGER` | Tenant | `report:read`, `report:write`, `report:export` | Create/export reports |
| `WORKFLOW_MANAGER` | Tenant | `workflow:read`, `workflow:write`, `workflow:execute` | Manage workflows |
| `HR_MANAGER` | Tenant | `user:read`, `user:write`, `payroll:read` | User + payroll read access |
| `AUDITOR` | Tenant | `expense:read`, `payroll:read`, `invoice:read`, `report:read`, `audit:read` | Read-only cross-module for compliance |

---

## 3. Cache Invalidation Flow

### 3.1 Cache Invalidation Flow

```mermaid
sequenceDiagram
    participant ADMIN as Tenant Admin
    participant RBAC as RBAC Service
    participant DB as PostgreSQL
    participant K as Kafka
    participant CACHE as Cache Consumer
    participant R as Redis

    ADMIN->>RBAC: Assign role to user
    RBAC->>DB: Insert user_role
    RBAC->>K: Emit ROLE_ASSIGNED {tenant_id, user_id}
    K->>CACHE: Consume ROLE_ASSIGNED
    CACHE->>R: DELETE perms:{tenant_id}:{user_id}
    Note over R: Next authz check will rebuild cache from DB
```

### 3.2 Kafka Topics for Cache Invalidation

| Topic | Events | Purpose |
|-------|--------|---------|
| `iam.permission.changed` | `ROLE_ASSIGNED`, `ROLE_REVOKED`, `PERMISSION_ADDED`, `PERMISSION_REMOVED` | Invalidate user permission cache |
| `iam.user.changed` | `USER_UPDATED`, `USER_DEACTIVATED` | Invalidate user profile cache |
| `iam.audit` | All auditable events | Persist to audit_logs table |

### 3.3 Cache Key Patterns

| Key Pattern | Value | TTL | Invalidation |
|-------------|-------|-----|-------------|
| `perms:{tenant_id}:{user_id}` | Set of permission strings | 5 min | Kafka event on role/permission change |
| `user:{user_id}` | User profile data | 5 min | On user update |

---

## 4. Multi-Tenant Isolation Flow

### 4.1 Tenant Isolation Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant MW as TenantMiddleware
    participant PG as PostgreSQL
    participant RLS as RLS Policy

    C->>MW: Request + JWT (contains tenant_id)
    MW->>PG: SET app.current_tenant = 'tenant-uuid'
    MW->>PG: SELECT * FROM users WHERE email = 'x'
    PG->>RLS: Evaluate Policy
    RLS->>RLS: WHERE tenant_id = current_setting('app.current_tenant')
    RLS-->>PG: Filtered Rows (tenant's data only)
    PG-->>MW: Results
```

---

## 5. Service-to-Service Communication Flows

### 5.1 Cross-Service Authorization Check

```mermaid
sequenceDiagram
    participant U as User
    participant EXP as Expense Service
    participant SDK as IAM SDK (in-process)
    participant R as Redis (Shared)
    participant IAM as IAM Service

    U->>EXP: POST /expenses (User JWT in Authorization header)
    EXP->>SDK: JwtAuthGuard validates user JWT locally
    SDK->>SDK: Extract user_id, tenant_id from JWT
    EXP->>SDK: PermissionGuard checks 'expense:write'
    SDK->>R: GET perms:{tenant_id}:{user_id}
    alt Cache Hit
        R-->>SDK: Effective permission set
        SDK->>SDK: hasPermission('expense:write') → true
        SDK-->>EXP: ALLOW
    else Cache Miss
        SDK->>IAM: POST /authorization/check
        Note over SDK,IAM: Forwards same user JWT (trusted K8s network)
        IAM->>IAM: Validate user JWT
        IAM->>IAM: Evaluate RBAC + overrides + ACL
        IAM-->>SDK: {allowed: true, effective_permissions: [...], source: 'rbac'}
        SDK->>R: SET perms:{tenant_id}:{user_id} with TTL 5min
        SDK-->>EXP: ALLOW
    end
    EXP->>EXP: Process expense creation
    EXP-->>U: 201 Created
```

### 5.2 Async Kafka Flow

For async operations (e.g., Expense Service publishes event to Kafka for Notification Service):

1. **Producer** extracts `user_id` and `tenant_id` from JWT **before** publishing to Kafka
2. **Kafka message** carries `{ user_id, tenant_id, ... }` as metadata (not the JWT itself)
3. **Consumer** uses the embedded context directly — no JWT validation needed
4. If consumer needs to check permissions, it calls IAM's `/authorization/check` with `user_id` and `tenant_id` in the request body

```mermaid
sequenceDiagram
    participant EXP as Expense Service
    participant K as Kafka
    participant NOT as Notification Service
    participant IAM as IAM Service

    EXP->>EXP: Extract user_id, tenant_id from JWT
    EXP->>K: Publish {event, user_id, tenant_id}
    K->>NOT: Consume message
    NOT->>NOT: Use user_id, tenant_id from message
    opt Needs permission check
        NOT->>IAM: POST /authorization/check {user_id, tenant_id, permission}
        Note over NOT,IAM: Internal K8s call — no JWT needed
        IAM-->>NOT: {allowed: true}
    end
    NOT->>NOT: Process notification
```

### 5.3 K8s Network Policy

```yaml
# K8s NetworkPolicy: only allow IAM traffic from known services
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: iam-allow-internal
spec:
  podSelector:
    matchLabels:
      app: iam-service
  ingress:
    - from:
        - podSelector:
            matchLabels:
              access: iam-authorized
      ports:
        - port: 3000
```

Only pods with label `access: iam-authorized` can reach IAM. External traffic goes through Ingress/API Gateway.

---

## 6. SuperAdmin & Impersonation Flow

### 6.1 Impersonation Flow

```mermaid
sequenceDiagram
    participant SA as SuperAdmin
    participant SAC as SuperAdminController
    participant SAS as SuperAdminService
    participant AS as AuthService
    participant DB as PostgreSQL
    participant K as Kafka

    SA->>SAC: POST /super-admin/impersonate {user_id, tenant_id, reason}
    SAC->>SAS: impersonate(dto, superAdminId)
    SAS->>DB: Find target user (bypass RLS — SuperAdmin role)
    DB-->>SAS: Target user record
    SAS->>SAS: Validate: target user is_active, not a SuperAdmin
    SAS->>AS: generateImpersonationToken(target, superAdminId)
    AS->>AS: Build impersonation JWT (30min TTL)
    AS-->>SAS: Impersonation token
    SAS->>K: Emit IMPERSONATION_STARTED {actor: superAdminId, target: userId, reason}
    SAS-->>SAC: ImpersonationTokenResponse
    SAC-->>SA: 200 {access_token, expires_in: 1800, identity_type: IMPERSONATION}
```

---

## 7. Audit Flow

### 7.1 Audit Pipeline

```mermaid
flowchart LR
    A["IAM Service"] -->|"Produce events"| B["Kafka Topic<br/>iam.audit"]
    B -->|"Consume"| C["Audit Consumer"]
    C -->|"Append-only INSERT"| D["PostgreSQL<br/>audit_logs table"]
    
    E["SuperAdmin"] -->|"Query"| F["Audit API"]
    F -->|"Read"| D
```

### 7.2 Auditable Events

| Category | Events |
|----------|--------|
| **Authentication** | `AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAILED`, `AUTH_LOGOUT`, `AUTH_TOKEN_REFRESHED` |
| **Authorization** | `AUTHZ_CHECK_ALLOWED`, `AUTHZ_CHECK_DENIED` |
| **User Management** | `USER_CREATED`, `USER_UPDATED`, `USER_ACTIVATED`, `USER_DEACTIVATED` |
| **Role Management** | `ROLE_CREATED`, `ROLE_UPDATED`, `ROLE_DELETED`, `ROLE_ASSIGNED`, `ROLE_REVOKED` |
| **Permission Management** | `PERMISSION_ADDED_TO_ROLE`, `PERMISSION_REMOVED_FROM_ROLE` |
| **ACL Management** | `ACL_CREATED`, `ACL_DELETED` |
| **Tenant Management** | `TENANT_CREATED`, `TENANT_UPDATED`, `TENANT_DEACTIVATED` |
| **Impersonation** | `IMPERSONATION_STARTED`, `IMPERSONATION_ENDED` |

### 7.3 Audit Event Schema

```json
{
  "event_id": "uuid",
  "event_type": "AUTH_LOGIN_SUCCESS",
  "timestamp": "2026-06-04T16:00:00Z",
  "actor": {
    "id": "user-uuid",
    "type": "USER",
    "email": "user@example.com"
  },
  "tenant_id": "tenant-uuid",
  "resource": {
    "type": "session",
    "id": "session-uuid"
  },
  "metadata": {
    "ip_address": "192.168.1.1",
    "user_agent": "Mozilla/5.0...",
    "correlation_id": "req-uuid"
  },
  "changes": {
    "before": {},
    "after": {}
  }
}
```

---

> **Related Documents:**
> - [02-architecture.md](./02-architecture.md) — System architecture and module structure
> - [03-database-schema.md](./03-database-schema.md) — Schema entities referenced in flows
> - [05-strategies.md](./05-strategies.md) — Why these design choices were made
> - [06-api-reference.md](./06-api-reference.md) — API endpoints for auth, RBAC, ACL, S2S

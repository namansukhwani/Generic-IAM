# IAM Service — Design Approaches, Strategies & Decisions

> **Version:** 1.0.0  
> **Status:** Approved for MVP  
> **Related:** [Architecture](./02-architecture.md) | [Assumptions & Tradeoffs](./07-assumptions-tradeoffs.md)

---

## Table of Contents

1. [Caching Strategy](#1-caching-strategy)
2. [Audit & Compliance Strategy](#2-audit--compliance-strategy)
3. [Security Strategy](#3-security-strategy)
4. [Architectural Approaches Explored](#4-architectural-approaches-explored)
5. [Decision Log](#5-decision-log)

---

## 1. Caching Strategy

### 1.1 What Is Cached

| Key Pattern | Value | TTL | Invalidation |
|-------------|-------|-----|-------------|
| `perms:{tenant_id}:{user_id}` | Set of permission strings | 5 min | Kafka event on role/permission change |
| `user:{user_id}` | User profile data | 5 min | On user update |

### 1.2 Rationale

- **Shared Redis** vs. local in-process cache: Redis is shared across all NestJS instances — consistent cache, no stale reads between replicas
- **5-minute TTL** + event-driven invalidation: balances freshness vs. Redis load. Pure TTL would cause stale caches; pure event-driven misses edge cases
- **Circuit breaker on Redis:** If Redis is down, permission check falls back to DB. Latency increases but service remains available

### 1.3 Cache Invalidation Approach

**Event-driven invalidation via Kafka:**
1. RBAC service emits `ROLE_ASSIGNED` to `iam.permission.changed` topic
2. Cache consumer deletes `perms:{tenant_id}:{user_id}` from Redis
3. Next authorization check rebuilds from DB and re-caches

This ensures caches are always invalidated within seconds of any permission change — no stale ALLOW after role revocation.

### 1.4 Redis vs. Alternatives

| Option | Latency | Consistency | Ops Cost |
|--------|---------|-------------|---------|
| **Redis (shared)** ✅ | ~1-2ms | Consistent across instances | Medium |
| Local in-memory | <0.1ms | Instance-local (stale risk with multiple pods) | None |
| No cache (DB only) | ~5-20ms | Always fresh | None |

**Decision:** Redis. p95 < 50ms authz SLA requires cache. Local cache fails with multiple instances (stale data risk).

---

## 2. Audit & Compliance Strategy

### 2.1 Audit Architecture

**Approach: Kafka → PostgreSQL (append-only)**

- IAM service emits audit events to `iam.audit` Kafka topic (fire-and-forget, non-blocking)
- Audit consumer batch-inserts into `audit_logs` table
- SuperAdmin queries audit via paginated REST API

**Why Kafka-buffered instead of direct DB writes:**
- Audit writes don't block the request path (latency-sensitive operations like login are unaffected)
- Kafka provides durability: if the audit DB is slow, events queue up without affecting the main service
- Decoupled consumer can be scaled independently

### 2.2 Audit Storage Decision

| Option | Pros | Cons |
|--------|------|------|
| **PostgreSQL (MVP)** ✅ | Single data store, existing infra, SQL queries, monthly partitioning | Not optimized for analytics, large table over time |
| TimescaleDB | Excellent time-series, auto-partitioning | New data store, ops overhead |
| ClickHouse | Best for high-volume analytics | Very high ops complexity for MVP |

**Decision:** PostgreSQL with monthly table partitioning for MVP. Migrate to TimescaleDB/ClickHouse if audit volume exceeds 100M rows/month.

### 2.3 Retention Policy

- **Hot storage:** 90 days in PostgreSQL (partition by month)
- **Archival:** Post-MVP — export older partitions to S3/object storage
- **Compliance:** append-only table (no UPDATE/DELETE permissions on audit_logs)

### 2.4 Compliance Alignment

| Standard | Relevant Controls | How We Address |
|----------|------------------|----------------|
| **SOC 2** | Access control, audit logging, encryption | RBAC + ACL, append-only audit logs, bcrypt |
| **GDPR** | Data isolation, right to deletion | Tenant isolation (RLS), user deactivation |
| **ISO 27001** | Identity management, access control, audit trails | Comprehensive RBAC, hierarchical permissions, Kafka audit |

---

## 3. Security Strategy

### 3.1 Security Measures

| Area | Measure | Details |
|------|---------|---------|
| **Password Storage** | bcrypt (cost 12) | Industry standard; timing-attack resistant |
| **Token Security** | Short-lived JWTs (15min) | Limits window of compromise |
| **Refresh Token** | Stored hashed in DB, rotated on use | Single-use tokens prevent replay |
| **SQL Injection** | TypeORM parameterized queries + RLS | Defense in depth |
| **Tenant Isolation** | PostgreSQL RLS | Database-level enforcement, not app-level |
| **Impersonation** | Short-lived (30min), audited, cannot impersonate SuperAdmin | Bounded blast radius |
| **K8s Network Isolation** | NetworkPolicies restrict S2S traffic | Only authorized pods can reach IAM |
| **CORS** | Whitelist-based | Only allow known frontend origins |
| **Helmet** | HTTP security headers | XSS, MIME sniffing, clickjacking protection |

### 3.2 Password Hashing Decision

| Option | Security | Performance | Ecosystem |
|--------|----------|-------------|-----------|
| **bcrypt (cost 12)** ✅ | Very high | ~250ms/hash (good for anti-brute-force) | Excellent |
| Argon2 | Highest (memory-hard) | Configurable | Good but less widespread |
| scrypt | High | Configurable | Limited NestJS support |

**Decision:** bcrypt. Battle-tested, widely supported, cost factor 12 = ~250ms per hash (strong brute-force resistance while remaining responsive).

### 3.3 Threat Model

| Threat | Vector | Mitigation |
|--------|--------|------------|
| **Brute Force** | Login endpoint | Post-MVP: rate limiting. MVP: bcrypt slows attempts |
| **Token Theft** | XSS, network sniffing | Short TTL, HTTPS-only, httpOnly cookies (frontend) |
| **Privilege Escalation** | Manipulating role/permission APIs | RBAC on RBAC: only Tenant_Admin can manage roles |
| **Cross-Tenant Data Leak** | Application bug bypasses isolation | RLS enforced at DB level — app bugs can't leak |
| **Insider Threat** | SuperAdmin abuse | Impersonation audit trail, short-lived tokens |
| **Replay Attack** | Reusing refresh tokens | Refresh token rotation — each token is single-use |

---

## 4. Architectural Approaches Explored

### 4.1 Architecture Approach: Modular Monolith vs. Alternatives

#### Approach 1: Pure Modular Monolith ✅ Selected

**Description:** Single NestJS application with well-defined domain modules. Internal module communication via NestJS dependency injection. Kafka only for async events (audit, cache invalidation).

| Aspect | Rating |
|--------|--------|
| Complexity | ⭐ Low |
| Extensibility | ⭐⭐⭐ High (modules are extractable) |
| Risk | ⭐ Low |
| Maintenance | ⭐ Easy |
| Performance | ⭐⭐⭐ High (in-process calls) |

**Pros:**
- Simple deployment (single artifact)
- No network overhead for inter-module calls
- Easy debugging and tracing
- Single transaction boundary
- Modules can be extracted to microservices later

**Cons:**
- Single point of failure (mitigated by multiple instances)
- Scaling is all-or-nothing (can't scale auth independently)
- Shared memory space (one module's leak affects all)

#### Approach 2: Modular Monolith with Internal Event Bus

**Description:** Same as Approach 1, but modules communicate via an internal event bus (NestJS CQRS module) instead of direct injection. Adds eventual consistency within the monolith.

| Aspect | Rating |
|--------|--------|
| Complexity | ⭐⭐ Medium |
| Extensibility | ⭐⭐⭐ High (event-driven) |
| Risk | ⭐⭐ Medium |
| Maintenance | ⭐⭐ Moderate |

**Why not chosen:** Adds eventual consistency complexity for operations that are inherently synchronous (auth → check permission). Overkill for MVP.

#### Approach 3: Microservices from Day 1

**Description:** Separate services for Auth, User Management, RBAC, Audit. Each with its own DB/schema. Communication via REST/gRPC + Kafka.

| Aspect | Rating |
|--------|--------|
| Complexity | ⭐⭐⭐ High |
| Extensibility | ⭐⭐⭐ Highest |
| Risk | ⭐⭐⭐ High |
| Maintenance | ⭐⭐⭐ Complex |

**Why not chosen:** Premature for MVP. Adds distributed transaction complexity, network latency on every auth check, and operational overhead (multiple deployments, service discovery, circuit breakers). Can evolve from Approach 1 when scale demands it.

### 4.2 Tenant Isolation Strategy

| Aspect | Shared DB + RLS ✅ | Schema per Tenant | DB per Tenant |
|--------|----------------|-------------------|---------------|
| **Isolation** | Row-level (strong with RLS) | Schema-level (strong) | Full (strongest) |
| **Operational Cost** | Low (1 DB) | Medium (N schemas) | High (N databases) |
| **Migration Complexity** | Low (1 migration) | High (N migrations) | Very High |
| **Max Tenants** | 100,000+ | ~10,000 | ~1,000 |
| **Cross-Tenant Queries** | Easy (SuperAdmin) | Harder | Hardest |

**Decision:** Shared DB + RLS — simplest to operate at scale. Single migration path. SuperAdmin bypass via DB role with `BYPASSRLS`.

### 4.3 Service-to-Service Authentication

| Option | How It Works | Pros | Cons |
|--------|-------------|------|------|
| **Forward user JWT only** ✅ | Microservice passes user's `Authorization: Bearer <user-jwt>` to IAM | Simplest. Single token. No extra infra. JWT validates user identity at every hop. | Can't audit which *service* called (only which user). |
| Dual-header (Service JWT + user headers) | Service JWT in `Authorization`, user context in headers | Clear service identity for audit | Requires service accounts, credential management. Over-engineered for same-cluster. |
| mTLS between services | Mutual TLS certificates | Strongest service identity | Certificate infrastructure, rotation complexity. Overkill. |

**Decision:** Forward user JWT. Same K8s cluster = trusted network. K8s NetworkPolicies restrict traffic. Eliminates SERVICE identity type, 2 DB tables, credential management.

### 4.4 Permission Model

| Approach | How It Works | Scalability | Flexibility | Complexity |
|----------|-------------|-------------|-------------|------------|
| **A: Assign multiple roles (additive only)** | User gets N roles, permissions are union | High | Low — can't subtract | Low |
| **B: Create unnamed per-user role** | Each customized user gets a unique role | Poor — role table explodes (M×N) | High | Medium |
| **C: Roles + User permission overrides (GRANT/DENY)** ✅ | Assign roles, then sparse overrides per user | **Highest** — overrides are sparse | **High** — add or subtract anything | Medium |

**Decision:** Option C (inspired by AWS IAM Allow/Deny model). DENY always wins. Overrides are sparse (~10% of users need them).

### 4.5 Authorization Guard Placement

| Approach | Latency | Coupling | Resilience |
|----------|---------|----------|------------|
| Every request calls IAM API | ~20-50ms network hop | Tight — IAM is SPOF | Fails if IAM is down |
| **Guards in microservice + local Redis cache** ✅ | ~1-2ms cache hit | Loose — only cache misses hit IAM | Degrades gracefully |

**Decision:** IAM SDK (`@iam/nestjs-sdk`) with guards running locally in each microservice. Check shared Redis first, fall back to IAM's `/authorization/check` on cache miss.

---

## 5. Decision Log

| # | Decision | Alternatives Considered | Rationale |
|---|----------|------------------------|-----------|
| D1 | **Modular Monolith** architecture | Microservices, Event-driven monolith | Simplest to build, deploy, debug. Modules extractable later. IAM is latency-sensitive — in-process calls are critical. |
| D2 | **PostgreSQL RLS** for tenant isolation | Schema-per-tenant, DB-per-tenant | RLS scales to 100K+ tenants with minimal ops overhead. Single migration path. SuperAdmin bypass via DB role. |
| D3 | **Hierarchical permissions** with wildcards | Flat permissions, ABAC | Wildcards (`resource:*`) provide 80% of ABAC flexibility with 20% complexity. Flat permissions too rigid for enterprise use. |
| D4 | **IAM owns ACLs centrally** | Services own their ACLs, Hybrid | Central ACL = single source of truth. Services don't need ACL infrastructure. Trade-off: IAM becomes resource-aware (but only at ID level). |
| D5 | **JWT + Refresh token rotation** | Session-based, Opaque tokens + introspection | JWTs are stateless — services can validate locally. Refresh rotation prevents replay. Trade-off: can't revoke access tokens instantly (15min TTL mitigates). |
| D6 | **Redis for permission caching** | Local in-memory cache, No cache | Redis is shared across instances — consistent cache. p95 < 50ms for authz checks. Trade-off: Redis dependency (circuit breaker handles failures). |
| D7 | **Kafka for audit events** | Direct DB writes, RabbitMQ | Kafka provides durability, ordering, and decoupling. Audit writes don't block request path. Trade-off: operational overhead of Kafka cluster. |
| D8 | **bcrypt** for password hashing | Argon2, scrypt | bcrypt is battle-tested, widely supported. Cost factor 12 = ~250ms per hash (good for anti-brute-force). Trade-off: Argon2 is technically superior but less ecosystem support. |
| D9 | **TypeORM** for ORM | Prisma, MikroORM, raw SQL | TypeORM integrates natively with NestJS. Decorator-based entities align with NestJS patterns. Trade-off: TypeORM has known issues with complex queries (mitigated by raw SQL for RLS setup). |
| D10 | **Email + password only** for MVP | OAuth2/SSO, Passwordless | Minimal external dependencies. OAuth2 adds complexity (provider management, token exchange). Extension points designed but not built. |
| D11 | **Append-only audit in PostgreSQL** | Dedicated audit DB (TimescaleDB, ClickHouse) | Single data store simplifies MVP. Monthly partitioning handles growth. Trade-off: PostgreSQL not optimized for append-only analytics (post-MVP migration path). |
| D12 | **Forward user JWT for S2S** (no service accounts) | Service accounts with client_id/secret, Dual-header, mTLS | Same K8s cluster = trusted network. K8s NetworkPolicies restrict traffic. Eliminates SERVICE identity type, 2 DB tables, credential management. Massive complexity reduction. |
| D13 | **No rate limiting in MVP** | Redis-based rate limiting | Reduces MVP scope. bcrypt's compute cost provides some brute-force resistance. Post-MVP: Redis sliding window rate limiter. |
| D14 | **Correlation ID via interceptor** | Middleware, Framework-level | NestJS interceptors have request/response context. Propagated via `X-Correlation-ID` header. |
| D15 | **User permission overrides** (GRANT/DENY per user) | Assign multiple roles only, Create unnamed per-user role | Overrides are sparse (~10% users need them). Roles stay clean templates. DENY-wins model matches AWS IAM. Per-user roles would explode the role table. |
| D16 | **IAM SDK for microservices** (`@iam/nestjs-sdk`) | Guards in IAM only (all services call IAM), Each service reimplements guards | SDK ensures consistent guard logic. Local Redis cache gives ~1ms authz checks vs ~20-50ms API calls. Kafka invalidation keeps caches fresh. |
| D17 | **No PgBouncer in MVP** | PgBouncer from day one | TypeORM's built-in pool is sufficient for <10 instances. PgBouncer adds operational complexity. Will add in Phase 4 when scaling beyond 10+ instances. |

---

> **Related Documents:**
> - [02-architecture.md](./02-architecture.md) — Architecture resulting from these decisions
> - [07-assumptions-tradeoffs.md](./07-assumptions-tradeoffs.md) — Assumptions behind these decisions and their tradeoffs

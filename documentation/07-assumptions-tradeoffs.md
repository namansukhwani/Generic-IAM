# IAM Service — Assumptions & Tradeoffs

> **Version:** 1.0.0  
> **Status:** Approved for MVP  
> **Related:** [Requirements](./01-requirements.md) | [Strategies](./05-strategies.md)

---

## Table of Contents

1. [Technical Assumptions](#1-technical-assumptions)
2. [Product Assumptions](#2-product-assumptions)
3. [Scale Assumptions](#3-scale-assumptions)
4. [Operational Assumptions](#4-operational-assumptions)
5. [Tradeoffs Summary Table](#5-tradeoffs-summary-table)
6. [Non-Goals for MVP](#6-non-goals-for-mvp)

---

## 1. Technical Assumptions

| ID | Assumption | Rationale |
|----|------------|-----------|
| T1 | JWT access tokens: 15min TTL, refresh tokens: 7d TTL, stored hashed in DB | Industry standard balance of security vs. UX. Short access token limits compromise window. |
| T2 | SuperAdmin is seeded at bootstrap, not self-registered. Global scope (not per-tenant) | Security: SuperAdmin creation must be a controlled, one-time operational step. |
| T3 | Kafka audit events are fire-and-forget in MVP (at-least-once, no replay guarantees) | Simplicity; guaranteed delivery adds significant consumer complexity. |
| T4 | All microservices run in the same K8s cluster — network-level trust, user JWT forwarded between services | Simplifies architecture. K8s NetworkPolicies restrict pod communication. No service accounts needed. |
| T5 | Organizational hierarchy is a simple tree (`manager_id` self-reference), not a DAG | Trees cover 99% of enterprise org charts; DAGs add recursive CTE complexity. |
| T6 | Permission cache TTL: 5 minutes + event-driven invalidation via Kafka consumer | Balance between freshness and Redis load. |
| T7 | Impersonation tokens: max 30min TTL, cannot impersonate SuperAdmin, always audited | Security: impersonation is high-risk, must be bounded and traceable. |
| T8 | Audit logs stored in PostgreSQL (append-only table) for MVP | Avoids adding another data store; can migrate to TimescaleDB/ClickHouse later. |
| T9 | TypeORM with migrations for schema management | Consistent with NestJS ecosystem; migration-based schema evolution. |
| T10 | Password hashing: bcrypt with cost factor 12 | Industry standard; balance of security (~250ms/hash) and performance. |
| T11 | All API responses follow consistent envelope format (`success`, `data`, `meta`) | Developer experience for consumers across all services. |
| T12 | Refresh token is stored as SHA-256 hash, rotated on every use | Single-use tokens prevent replay attacks even if DB is compromised. |
| T13 | RLS session variable (`app.current_tenant`) is set by `TenantTransactionInterceptor` for every request | Ensures all DB queries within a request are automatically tenant-scoped. |

---

## 2. Product Assumptions

| ID | Assumption | Rationale |
|----|------------|-----------|
| P1 | Tenant = single organization (company). Users belong to exactly one tenant. | No cross-tenant user identity in MVP; simplifies isolation model. |
| P2 | Permission codes use `resource:action` dot notation (e.g., `expense:read`) | Enables wildcard matching (`expense:*`, `*:*`) for hierarchical inheritance. |
| P3 | Wildcard permissions (`expense:*`, `*:*`) are evaluated at runtime, not persisted as literal strings | Stored only as `expense` + `*` in DB; evaluation logic expands wildcards. |
| P4 | DENY permission overrides always win over GRANT (explicit deny = absolute deny) | Matches AWS IAM model; prevents privilege escalation via role stacking. |
| P5 | Users are assigned system roles on creation (`TENANT_USER` auto-assigned) | Ensures every user has baseline permissions; simplifies onboarding. |
| P6 | ACL entries are owned by IAM centrally, not by individual microservices | Single source of truth for access control; services query IAM for ACL decisions. |
| P7 | SuperAdmin has no tenant_id — cross-tenant visibility by design | SuperAdmin operates at platform level, not within any specific organization. |
| P8 | Impersonation cannot target another SuperAdmin | Security constraint: cannot use impersonation to escalate to SuperAdmin level. |

---

## 3. Scale Assumptions

| ID | Assumption | Target | Notes |
|----|------------|--------|-------|
| S1 | Tenant scale | 10,000+ tenants | Up to 100,000 with RLS approach |
| S2 | User scale | 10M+ users | ~1,000 users/tenant average |
| S3 | Auth requests | 1,000 RPS sustained | 3× spike during business hours |
| S4 | AuthZ requests | 10,000 RPS sustained | Every service request = 1-2 authz checks |
| S5 | Permission cache entries | 10M keys | ~64 bytes key + ~1KB value = ~10GB Redis |
| S6 | Audit events/day | ~50M | 5 events/user/day average |
| S7 | DB size (1 year) | ~500GB | Dominated by audit_logs table |
| S8 | Permission overrides per user | ~10% of users need them | ~1M override rows for 10M users |

---

## 4. Operational Assumptions

| ID | Assumption | Rationale |
|----|------------|-----------|
| O1 | Single-region deployment for MVP | Multi-region adds extreme complexity (data residency, eventual consistency). Unnecessary for initial scale. |
| O2 | Redis is non-replicated for MVP | Single Redis node sufficient for MVP scale. Redis Cluster added in Phase 4. |
| O3 | Kafka with 3 brokers minimum | Fault tolerance; default replication factor = 1 (can increase). |
| O4 | PostgreSQL primary + 1 read replica | Read replica for audit log queries; automatic failover via managed DB or Patroni. |
| O5 | TypeORM connection pool: 10-20 connections per instance | Sufficient for <10 NestJS instances. PgBouncer added in Phase 4 for 10+ instances. |
| O6 | Health checks expose DB, Redis, Kafka connectivity | K8s readiness probe fails fast if any dependency is down. |

---

## 5. Tradeoffs Summary Table

| Decision | Choice Made | Alternative Rejected | Tradeoff |
|----------|------------|---------------------|---------|
| **Architecture** | Modular Monolith | Microservices | ✅ Simple deploy, in-process latency / ❌ All-or-nothing scaling |
| **Tenant isolation** | Shared DB + PostgreSQL RLS | Schema/DB per tenant | ✅ 100K+ tenants, 1 migration / ❌ Row-level (not schema-level) isolation |
| **Token strategy** | Stateless JWT + DB refresh tokens | Session-based / opaque tokens | ✅ Services validate locally, no central lookup / ❌ Access token can't be instantly revoked (15min TTL mitigates) |
| **Permission model** | Roles + sparse GRANT/DENY overrides | Multiple roles (additive) / per-user roles | ✅ Sparse overrides, clean roles / ❌ Slight complexity in effective-permissions computation |
| **Caching** | Shared Redis | Local in-memory | ✅ Consistent across replicas / ❌ Redis is a dependency (circuit breaker handles failures) |
| **Audit pipeline** | Kafka → PostgreSQL | Direct DB writes | ✅ Non-blocking writes, durable / ❌ Kafka operational overhead |
| **Audit storage** | PostgreSQL (partitioned) | TimescaleDB / ClickHouse | ✅ No new data store / ❌ Not optimized for time-series analytics (migrate post-MVP) |
| **S2S auth** | Forward user JWT | Service accounts + client credentials | ✅ Zero extra infrastructure / ❌ Can't audit which service called (only which user) |
| **Guard placement** | Guards in microservices (SDK) | Guards in IAM only (all services call IAM) | ✅ ~1ms local cache hits / ❌ SDK must be kept in sync across services |
| **Password hashing** | bcrypt cost 12 | Argon2id | ✅ Battle-tested, NestJS support / ❌ Argon2 is technically memory-harder |
| **ORM** | TypeORM | Prisma | ✅ Native NestJS decorator support / ❌ Complex queries need raw SQL; TypeORM quirks |
| **Rate limiting** | Deferred to post-MVP | Redis sliding window | ✅ Reduces MVP scope; bcrypt provides some resistance / ❌ Brute force possible in MVP |
| **Connection pooling** | TypeORM built-in pool | PgBouncer | ✅ No extra infra for <10 instances / ❌ Connection exhaustion risk with 10+ instances |
| **ACL ownership** | IAM owns ACLs centrally | Services own their own ACLs | ✅ Single source of truth / ❌ IAM must be aware of external resource IDs |
| **Impersonation duration** | 30min max TTL | Longer sessions | ✅ Bounded blast radius / ❌ May require re-impersonation for long support sessions |

---

## 6. Non-Goals for MVP

The following were explicitly descoped from MVP with extension points designed but not built:

| Feature | Why Deferred | Extension Point |
|---------|-------------|----------------|
| **OAuth2 / SAML SSO** | Provider management complexity; email+password covers MVP | Auth strategy pattern in `auth.module.ts` (Passport strategies) |
| **Rate limiting** | bcrypt provides implicit resistance; reduces MVP complexity | Redis sliding window post-MVP |
| **Password reset** | Requires email infrastructure (SMTP/SendGrid) | `POST /auth/password-reset` endpoint reserved |
| **Email verification** | Requires email infrastructure | `POST /auth/verify-email` endpoint reserved |
| **Token blacklist** | Redis-based; adds per-request Redis lookup for access tokens | `token_blacklist` key pattern reserved in Redis |
| **MFA (TOTP/SMS)** | Requires 2FA provider integration | Auth flow has hook point for 2FA challenge |
| **ABAC** | Complex policy engine; hierarchical RBAC + ACL covers 95% of use cases | Permission system supports custom attributes in `metadata` |
| **PgBouncer** | TypeORM pool sufficient for <10 instances | Infrastructure config ready to add |
| **Multi-region** | Data residency, replication complexity | Event-sourced audit enables future replay |
| **SCIM provisioning** | Enterprise directory sync | User CRUD APIs are SCIM-compatible structure |

---

> **Related Documents:**
> - [01-requirements.md](./01-requirements.md) — Full requirements these assumptions support
> - [05-strategies.md](./05-strategies.md) — Detailed rationale for each approach explored

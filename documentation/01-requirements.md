# IAM Service — Functional & Non-Functional Requirements

> **Version:** 1.0.0  
> **Status:** Approved for MVP  
> **Related:** [Architecture](./02-architecture.md) | [Assumptions & Tradeoffs](./07-assumptions-tradeoffs.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Functional Requirements](#3-functional-requirements)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [Understanding Summary](#5-understanding-summary)
6. [MVP Feature Matrix](#6-mvp-feature-matrix)
---

## 1. Executive Summary

This document defines the **functional and non-functional requirements** for an enterprise-grade Identity and Access Management (IAM) backend service. The IAM service is the central security layer for a multi-tenant SaaS platform comprising multiple microservices (Expense, Payroll, Invoice, Reporting, Workflow, Notification).

**Key characteristics:**
- **Modular Monolith** architecture in **NestJS** with clean domain boundaries
- **PostgreSQL** with Row-Level Security (RLS) for tenant isolation
- **Hierarchical RBAC** + **Resource-level ACLs** for fine-grained access control
- **JWT-based** authentication supporting 3 identity types
- **Kafka**-driven audit logging for compliance
- **Redis**-based permission caching for performance
- Designed for **thousands of tenants** and **millions of users**

---

## 2. Problem Statement

Design an enterprise-grade Access Control System for a multi-tenant microservices-based SaaS platform that supports:

- Multiple organizations (tenants) with their own users, hierarchy, roles, and policies
- Authentication and authorization for both frontend (SPA/mobile) and backend (microservices)
- Fine-grained access control with resource-level granularity
- Tenant isolation with zero data leakage
- Cross-service authorization and service-to-service communication
- Auditability and security compliance
- Scale: thousands of tenants, millions of users, high request throughput

### Platform Services Consuming IAM

| Service | Dependency on IAM |
|---------|------------------|
| User Management | Identity, tenant CRUD, hierarchy |
| Expense Management | Permission checks, resource ACLs |
| Payroll | Permission checks, service auth |
| Reporting | Cross-resource read permissions |
| Workflow | Dynamic permission evaluation |
| Notification | Service-to-service auth |
| Invoice Management | Permission checks, resource ACLs |

---

## 3. Functional Requirements

### 3.1 Authentication
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-AUTH-01 | Email + password login | P0 |
| FR-AUTH-02 | JWT access token (short-lived, 15min) | P0 |
| FR-AUTH-03 | JWT refresh token (long-lived, 7d) | P0 |
| FR-AUTH-04 | Three identity types: User, SuperAdmin, Impersonation | P0 |
| FR-AUTH-05 | Token revocation (logout) | P0 |

### 3.2 User Management
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-USER-01 | User CRUD within a tenant | P0 |
| FR-USER-02 | Organization (tenant) creation and management | P0 |
| FR-USER-03 | Self-referential org hierarchy (manager_id) | P0 |
| FR-USER-04 | User activation/deactivation | P0 |
| FR-USER-05 | User profile retrieval (self) | P0 |

### 3.3 Role-Based Access Control (RBAC)
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-RBAC-01 | Pre-seeded system roles (Tenant_Admin, Tenant_User) | P0 |
| FR-RBAC-02 | Tenant-specific custom role creation | P0 |
| FR-RBAC-03 | Role-to-permission mappings | P0 |
| FR-RBAC-04 | User-to-role assignments | P0 |
| FR-RBAC-05 | Time-bound role assignments with expiry | P0 |
| FR-RBAC-06 | Hierarchical permission model with wildcard inheritance | P0 |

### 3.4 Fine-Grained Authorization
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-ACL-01 | Resource-level ACL support (user, resource_type, resource_id, permission) | P0 |
| FR-ACL-02 | Combined RBAC + ACL evaluation | P0 |
| FR-ACL-03 | ACL CRUD APIs | P0 |

### 3.5 Super Administration
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-SA-01 | Global SuperAdmin with cross-tenant visibility | P0 |
| FR-SA-02 | Impersonation with short-lived tokens (30min max) | P0 |
| FR-SA-03 | Impersonation audit trail | P0 |

### 3.6 Service-to-Service Communication
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-S2S-01 | Forward user JWT between services in K8s cluster | P0 |
| FR-S2S-02 | Centralized authorization check API | P0 |

### 3.7 Audit & Compliance
| ID | Requirement | Priority |
|----|-------------|----------|
| FR-AUDIT-01 | Event-driven audit logging via Kafka | P0 |
| FR-AUDIT-02 | Append-only audit log storage | P0 |
| FR-AUDIT-03 | Track: auth events, role changes, ACL changes, impersonation | P0 |

---

## 4. Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-01 | **Availability** | 99.9% uptime |
| NFR-02 | **Latency — Auth endpoints** | p95 < 200ms |
| NFR-03 | **Latency — Authorization checks** | p95 < 50ms (cached) |
| NFR-04 | **Throughput** | 10,000 RPS sustained |
| NFR-05 | **Tenant scale** | 10,000+ tenants |
| NFR-06 | **User scale** | 10M+ users |
| NFR-07 | **Data isolation** | Zero cross-tenant data leakage |
| NFR-08 | **Token security** | Access token ≤ 15min, refresh ≤ 7d |
| NFR-09 | **Audit retention** | 90 days hot, archival policy TBD |
| NFR-10 | **Deployment** | Docker / Kubernetes (self-hosted) |
| NFR-11 | **Recovery** | RPO < 1 hour, RTO < 15 minutes |
| NFR-12 | **Password security** | bcrypt (cost factor 12) |

---

## 5. Understanding Summary

1. **What:** Enterprise-grade multi-tenant IAM backend service (Modular Monolith) providing authentication, RBAC with hierarchical permissions, resource-level ACLs, audit logging, and centralized authorization.

2. **Why:** Central security layer for a SaaS platform with multiple services. Single source of truth for identity, access control, and compliance.

3. **Who:** Consumed by both frontend apps (SPA/mobile → login, profile, token refresh) and backend microservices (authorization checks, impersonation).

4. **Tech Stack:** NestJS, PostgreSQL (RLS), Redis (caching), Kafka (audit events), TypeORM. Self-hosted (Docker/K8s).

5. **Access Control Model:** RBAC with hierarchical permissions (`resource:action` with wildcard inheritance) + centralized resource-level ACLs owned by IAM.

6. **Scope:** Full MVP — documentation + working codebase. Email+password auth only.

7. **Non-goals for MVP:** OAuth2/SSO, rate limiting, password reset, email verification, ABAC, multi-region deployment.

---

## 6. MVP Feature Matrix

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Multi-tenant DB with RLS | ✅ MVP | P0 | Foundation |
| JWT auth (access + refresh) | ✅ MVP | P0 | |
| 3 identity types | ✅ MVP | P0 | User, SuperAdmin, Impersonation |
| User CRUD | ✅ MVP | P0 | |
| Org hierarchy (manager_id) | ✅ MVP | P0 | |
| User activate/deactivate | ✅ MVP | P0 | |
| System roles (pre-seeded, 15+ roles) | ✅ MVP | P0 | Rich predefined role library |
| Custom roles | ✅ MVP | P0 | Tenant-scoped |
| Role-permission mapping | ✅ MVP | P0 | |
| User-role assignment | ✅ MVP | P0 | |
| User permission overrides (GRANT/DENY) | ✅ MVP | P0 | Per-user add/subtract from roles |
| Time-bound roles | ✅ MVP | P0 | |
| Hierarchical permissions | ✅ MVP | P0 | Wildcard matching |
| Redis permission cache | ✅ MVP | P0 | Shared across microservices |
| Event-driven cache invalidation | ✅ MVP | P0 | Via Kafka |
| Resource-level ACLs | ✅ MVP | P0 | |
| Combined RBAC + overrides + ACL eval | ✅ MVP | P0 | |
| SuperAdmin + impersonation | ✅ MVP | P0 | |
| S2S via forwarded user JWT | ✅ MVP | P0 | K8s network trust, no service accounts |
| Centralized authz API | ✅ MVP | P0 | |
| IAM NestJS SDK (`@iam/nestjs-sdk`) | ✅ MVP | P0 | Guards, decorators, cache for microservices |
| Kafka audit logging | ✅ MVP | P0 | |
| Append-only audit storage | ✅ MVP | P0 | |
| Correlation IDs | ✅ MVP | P0 | |
| Health checks | ✅ MVP | P0 | |
| Structured logging | ✅ MVP | P0 | |
| OAuth2 / SSO | ❌ Post-MVP | P2 | Extension points designed |
| Rate limiting | ❌ Post-MVP | P1 | Redis sliding window |
| Password reset | ❌ Post-MVP | P1 | Requires email infra |
| Email verification | ❌ Post-MVP | P2 | |
| Token blacklist | ❌ Post-MVP | P1 | Redis-based |
| PgBouncer | ❌ Post-MVP | P2 | Connection pooler for 10+ instances |
| Multi-region | ❌ Post-MVP | P3 | |
| ABAC | ❌ Post-MVP | P3 | |

---

> **Related Documents:**
> - [02-architecture.md](./02-architecture.md) — System architecture and module structure
> - [07-assumptions-tradeoffs.md](./07-assumptions-tradeoffs.md) — Assumptions and design tradeoffs

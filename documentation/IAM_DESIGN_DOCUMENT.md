# IAM Service — Design Document Index

> **Version:** 1.0.0  
> **Date:** 2026-06-04  
> **Status:** Approved for MVP Implementation  
> **Author:** Product & Architecture Team

---

## Executive Summary

Enterprise-grade Identity and Access Management (IAM) backend service serving as the central security layer for a multi-tenant SaaS platform.

**Key characteristics:**
- **Modular Monolith** — NestJS with clean domain boundaries
- **PostgreSQL + RLS** — Row-Level Security for tenant isolation
- **Hierarchical RBAC + Resource ACLs** — fine-grained access control
- **JWT authentication** — 3 identity types (User, SuperAdmin, Impersonation)
- **Kafka audit logging** — event-driven compliance
- **Redis permission cache** — p95 < 50ms authorization

**Scale targets:** 10,000+ tenants · 10M+ users · 10,000 RPS

---

## Problem Statement

Design an enterprise-grade Access Control System for a multi-tenant microservices-based SaaS platform that supports multiple organizations with their own users, hierarchy, roles, and policies. Authentication and authorization for both frontend (SPA/mobile) and backend microservices (Expense, Payroll, Invoice, Reporting, Workflow, Notification).

---

## Key Design Principles

1. **Isolation first** — PostgreSQL RLS enforces tenant isolation at the DB layer. Application bugs cannot leak cross-tenant data.
2. **Cache-ahead authorization** — Shared Redis caches permission sets across all NestJS replicas. p95 authz < 50ms.
3. **Deny wins** — User-level DENY overrides always beat GRANT. Explicit deny = absolute deny.
4. **Simplicity over premature optimization** — Modular Monolith over microservices. PgBouncer after 10+ instances. Kafka for async only.
5. **Defense in depth** — bcrypt + short JWT TTL + refresh rotation + RLS + K8s NetworkPolicies.

---

## Documentation Index

| # | Document | Contents | Audience |
|---|----------|----------|---------|
| **01** | [Functional & Non-Functional Requirements](./01-requirements.md) | Problem statement, FR tables, NFR SLAs, MVP matrix, roadmap | Product, Engineering |
| **02** | [High-Level Architecture](./02-architecture.md) | C4 diagrams, module structure, RLS strategy, scalability, ops | Engineering, DevOps |
| **03** | [Database Schema & ERD](./03-database-schema.md) | ERD diagram, entity definitions, indexes, RLS policies, base entities | Engineering, DBA |
| **04** | [Flows & Sequence Diagrams](./04-flows.md) | Auth flows, authorization decision, S2S flows, audit pipeline, impersonation | Engineering |
| **05** | [Design Approaches & Decisions](./05-strategies.md) | All approaches explored, caching strategy, audit strategy, decision log | Architecture |
| **06** | [API Reference](./06-api-reference.md) | All REST endpoints, request/response schemas, working cURL examples | Engineering, API consumers |
| **07** | [Assumptions & Tradeoffs](./07-assumptions-tradeoffs.md) | Technical/product/scale/operational assumptions, tradeoffs table, non-goals | All |

---

## Quick Navigation

### By Role

**Backend Engineers:** [Architecture →](./02-architecture.md) · [DB Schema →](./03-database-schema.md) · [API Reference →](./06-api-reference.md)

**Security / Architects:** [Flows →](./04-flows.md) · [Strategies →](./05-strategies.md) · [Assumptions →](./07-assumptions-tradeoffs.md)

**Product / Stakeholders:** [Requirements →](./01-requirements.md) · [Assumptions →](./07-assumptions-tradeoffs.md)

**API Consumers / Microservice Teams:** [API Reference →](./06-api-reference.md) · [Flows →](./04-flows.md)

### By Topic

| Topic | Document |
|-------|---------|
| Login / token flow | [04-flows.md §1](./04-flows.md#1-authentication-flows) |
| Permission check flow | [04-flows.md §2](./04-flows.md#2-authorization-flows) |
| RLS setup | [02-architecture.md §5](./02-architecture.md#5-multi-tenant-isolation-strategy) |
| ERD / entity definitions | [03-database-schema.md](./03-database-schema.md) |
| Working cURLs | [06-api-reference.md §10](./06-api-reference.md#10-curl-examples) |
| Decision rationale | [05-strategies.md §5](./05-strategies.md#5-decision-log) |
| What's NOT in MVP | [07-assumptions-tradeoffs.md §6](./07-assumptions-tradeoffs.md#6-non-goals-for-mvp) |
| Scalability targets | [02-architecture.md §6](./02-architecture.md#6-scalability--reliability) |

---

## Implementation Plan

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for the atomic task breakdown and workstream execution order.

See [iam-refactoring-plan.md](./iam-refactoring-plan.md) for the refactoring workstreams and completion status.

---

> **Document Status:** Approved for MVP Implementation  
> **Last Updated:** 2026-06-05

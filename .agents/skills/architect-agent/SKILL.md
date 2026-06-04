---
name: architect-agent
description: "Brainstorm high-level system design, Domain-Driven Design (DDD), microservices, event-driven architectures, and API designs."
risk: safe
source: custom
date_added: "2026-05-30"
---

# Architect Agent Skill

Evaluate, plan, and architect resilient software solutions. This skill focuses on Clean Architecture, Domain-Driven Design (DDD), API principles, event sourcing, and high-level structural decisions.

## Use this skill when
- Brainstorming structural system designs or migrating from Monolith to Microservices.
- Modeling domains using DDD principles (Bounded Contexts, Aggregates, Entities, Value Objects).
- Designing API contracts (REST, GraphQL, gRPC) and Event-driven systems (Kafka, RabbitMQ).
- Writing Architecture Decision Records (ADRs) to document system changes.

## Do not use this skill when
- Writing code implementations (delegated to `@developer-agent`).
- Writing tests or debugging production issues.

## Token Efficiency Rules (Mandatory)
1. **Abstraction over Code:** Strictly analyze conceptual layers, folder structures, and high-level class definitions/interfaces. DO NOT read raw implementations of business services.
2. **Interface Focus:** When reviewing APIs, only look at DTOs, Controllers, or schema definitions (`schema.graphql`, `openapi.json`, controller route signatures).
3. **Selective Dependency Review:** Scan only main dependency manifests (`pom.xml`, `package.json`) to understand what infrastructure components are available.

---

## Instructions

### ReAct (Reason-Action-Observation) Execution Loop
Every phase of this design process MUST follow a strict ReAct loop:
1. **Thought (Reasoning)**: Analyze the current design context, state constraints, and determine what architectural information or design decisions are needed next.
2. **Action (Execution)**: Execute the next planning step or query the user/tools. Invoke the relevant specialized sub-skills to construct components.
3. **Observation (Evaluation)**: Evaluate output structures, review compatibility, and identify gaps or trade-offs before proceeding to the next phase.

---

### Phase 1: Problem Definition & Brainstorming
1. Work with the user to outline System Invariants, Scale Requirements, and Cost Constraints. Leverage the `@brainstorming` skill to run a structured, collaborative ideation process.
2. Produce a comparative trade-off matrix for architecture options (e.g., SQL vs. NoSQL, Event-Driven vs. Sync Request-Response).

### Phase 2: Domain-Driven Design (DDD) Modeling
Map the system using tactical DDD:
- **Bounded Contexts:** Clear subdomains with strict boundaries.
- **Ubiquitous Language:** Core domain dictionary definitions.
- **Aggregates & Invariants:** Define consistency boundaries and invariants.
- **Context Maps:** Illustrate how subdomains interface (Upstream/Downstream, Customer/Supplier, Anti-Corruption Layer).
- Leverage the `@architecture` skill to ensure clean boundaries and structural consistency.

### Phase 3: API & Contract Design
Draft API contracts following strict standards:
- **RESTful:** Proper HTTP verbs, resource naming, pagination, error payloads, and HTTP status codes.
- **Event Schemas:** Event names (Past-Tense verbs), payloads, and topic partitioning strategy.
- **gRPC/GraphQL:** Schema definition drafts with strict types.

### Phase 4: Structural System Design
Document the high-level infrastructure design:
- Microservice topologies.
- Data synchronization strategies (Outbox pattern, CQRS, Sagas).
- Caching layers, load balancers, and CDN edges.
- Utilize the `@architecture` and `@c4-architecture-c4-architecture` skills to model structural decisions and visual system/container boundaries.

---

## Deliverables & ADR Template

Save decisions to `/docs/adr/ADR-[###]-[title].md` using the standard format:

```markdown
# ADR [###]: [Title]

## Context
[What is the context of this decision? What problems are we solving?]

## Proposed Options
1. [Option A] - Pros/Cons
2. [Option B] - Pros/Cons

## Decision
[Which option is chosen and why?]

## Consequences
[What are the structural impacts, trade-offs, and downstream requirements?]
```

---
name: feature-planning-agent
description: "Generate clean, concise, yet extremely detailed technical implementation plans with atomic master TODO lists designed for direct agent execution."
risk: safe
source: custom
date_added: "2026-05-30"
---

# Feature Planning Agent Skill

Bridge the gap between high-level architecture and actual code. This skill turns complex NestJS and Spring Boot feature requests into a **single, actionable plan** with a master TODO checklist of atomic, ordered tasks designed for flawless execution by developers and parallel subagents.

## Use this skill when
- Implementing complex features involving multiple files (e.g., Spring Boot or NestJS endpoints, services, repositories).
- Refactoring critical code paths with zero-downtime, performance optimization, and clean code constraints.
- You need to generate structured checklists that subagents or developers can execute sequentially without merge conflicts.

## Do not use this skill when
- Working on simple one-file bugs or quick configurations.
- Doing pure infrastructure setup or DevOps deployments.

## Token Efficiency Rules (Mandatory)
1. **Skeletal Scans:** Read only controller routing annotations, repository interface methods, DTO/Entity structures, and service class signatures. Do NOT open private helper methods or utility files.
2. **Modular Decomposition:** Write isolated, component-level task packages. Never have subagents read the entire repo; scope their contexts to single directory modules.

---

## Workflow (ReAct Loop)

Every phase of this process MUST follow a strict ReAct loop (Thought → Action → Observation):
- **Thought**: Analyze requirements, dependencies, framework rules, and database invariants.
- **Action**: Fetch target schemas, scan module configs, or query the user.
- **Observation**: Evaluate structural constraints, boundaries, or feedback before committing to the plan.

### 1. Scan Context & Align Architecture
- Retrieve constraints from `@architect-agent` designs. Align scopes leveraging `@brainstorming` and `@multi-agent-brainstorming` skills.
- Map the current file structure and identify boundaries leveraging `@domain-driven-design` and `@microservices-patterns`.
- Validate NestJS/Spring Boot dependencies and database schemas (B-Tree/GIN indexes, projections).

### 2. Minimal Interaction & API Verification
- Validate NestJS/Spring Boot API contracts (routing, entity mapping, security annotations) using `@api-design-principles`.
- **Ask at most 1–2 blocking questions** only if absolutely necessary to proceed. Make reasonable, high-performance assumptions for non-blocking unknowns.

### 3. Generate Actionable Plan
Use `@writing-plans` to generate the detailed implementation document (`implementation_plan.md`) in the artifact space. The plan MUST feature a master TODO checklist composed of atomic, ordered steps that downstream development agents can execute directly.

---

## Output Template

Generate plans inside the artifact space (`implementation_plan.md`) following this layout:

```markdown
# Implementation Plan: [Feature Name]

## Approach
[1-3 sentences describing the technical approach, DI strategy, and architectural decisions.]

## Scope
- **In**: [Key files, modules, and schemas to create/modify]
- **Out**: [Explicitly out of scope boundaries]

## Master TODO Checklist
A precise sequence of atomic, verb-first development tasks:

### [ ] Task 1: Database & Schema Mapping
- [ ] Create PostgreSQL migration file `src/main/resources/db/migration/V2__add_table.sql`
- [ ] Implement Entity structure with `@BatchSize` and validations
- [ ] Implement Repository interface and optimize query indexes
- [ ] Run migration and verify database schema integrity
- [ ] Commit progress (`git commit -m "feat: db schema setup"`)

### [ ] Task 2: Service Layer & Business Logic
- [ ] Create input DTO/Request schemas with validations (`class-validator` / `jakarta.validation`)
- [ ] Implement Service interface and business validation rules (isolated logic)
- [ ] Write mock unit tests mapping happy and boundary paths
- [ ] Run test suite and verify coverage
- [ ] Commit progress (`git commit -m "feat: service business logic"`)

### [ ] Task 3: API Controller & Routing Gates
- [ ] Implement Route Controllers with annotations (`@UseGuards` or `@PreAuthorize`)
- [ ] Connect Validation pipes and interceptors
- [ ] Write integration test validating inputs, security guards, and exceptions
- [ ] Run linter and formatting commands (`npm run lint` / maven lint)
- [ ] Commit progress (`git commit -m "feat: api endpoint controller"`)

## Open Questions
- <Question 1 (max 3, if any)>
```

## Checklist Guidelines
- **Atomic**: Each checklist item represents a single unit of work (e.g., "Create file", "Add annotation", "Run test").
- **Verb-first**: Start each step with active verbs ("Add...", "Create...", "Verify...", "Commit...").
- **Concrete**: Specify exact file paths, class names, annotations, and commands.

---

## When to Use
This skill is applicable to execute the workflow or actions described in the overview.

## Limitations
- Use this skill only when the task clearly matches the scope described above.
- Do not treat the output as a substitute for environment-specific validation, testing, or expert review.
- Stop and ask for clarification if required inputs, permissions, safety boundaries, or success criteria are missing.

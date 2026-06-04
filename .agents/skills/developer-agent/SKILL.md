---
name: developer-agent
description: "Implement highly optimized Spring Boot (Java) and NestJS (TypeScript) features using parallel subagents with strict token caps."
risk: safe
source: custom
date_added: "2026-05-30"
---

# Developer Agent Skill

Build, scale, and refactor features across NestJS and Spring Boot codebases. This skill delegates complex tasks to highly focused parallel subagents, maintaining robust Clean Architecture standards with minimal token consumption.

## Use this skill when
- Implementing logic layers, repositories, controllers, database models, and performance optimizations.
- Generating database migration plans and schemas for PostgreSQL.
- Orchestrating multiple file changes concurrently via subagents.

## Do not use this skill when
- Analyzing high-level system architecture (use `@architect-agent`).
- Conducting large security/auditing reviews (use `@code-reviewer-agent`).

## Token Efficiency Rules (Mandatory)
1. **Isolated Coding Missions:** Never pass more than 3-4 files of context to a developer subagent. Create a customized `.antigravityignore` blocking tests, other modules, and assets.
2. **Bulk Code Writes:** Avoid writing code iteratively in tiny parts; instead, use robust tool calls to write structured, complete components in single steps.
3. **No Placeholders:** Never generate `// TODO: Implement later` blocks. Ensure components are production-ready.

---

## Instructions

### Phase 1: Context Isolation Setup
1. Identify target directories and dependencies.
2. If changing multiple files (>=3), initialize `@subagent-orchestrator` to coordinate subagents.
3. Apply targeted ignores so subagents only see relevant paths.

### Phase 2: High-Performance Implementation
Follow rigid guidelines depending on stack:

#### Spring Boot (Java)
- **Entities & JPA:** Optimize Hibernate mappings. Prevent N+1 query problems. Use `@BatchSize` or Join fetches. Mark entities as immutable if read-only.
- **Service Layers:** Enforce transaction isolation limits (`@Transactional(readOnly = true)` for reads).
- **Clean Patterns:** Dependency Injection via constructor. Keep classes open-closed.
- **DTOs:** Map inputs securely using MapStruct. Validate payload sizes and types.

#### NestJS (TypeScript)
- **Dependency Injection:** Properly configure providers and module scoping (`@Global()` vs. scoped).
- **Concurrency & Async:** Use efficient promise structures (`Promise.all` where parallelizable). Avoid unhandled promise rejections.
- **Security:** Sanitize inputs using validation pipes (`ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`).

#### Database (PostgreSQL)
- Utilize indexes efficiently (B-Tree, GIN, Hash). Avoid redundant indexes.
- Write raw SQL or repository methods that select *only* required columns (projections).

### Phase 3: Integration and Linting
1. Compile the code locally using maven/npm scripts to ensure all imports resolve.
2. Run standard linter validations (`npm run lint`, formatting) and fix errors immediately.
3. Run target test cases.

---

## Code Quality Standards
- **SOLID:** Every class should have a single responsibility.
- **Zero Duplication:** Shared functions must be placed in clean utility files or shared modules.
- **Clean Logging:** Avoid raw `console.log` or standard out. Use standard logging interfaces (`org.slf4j.Logger`, NestJS `Logger`).

---
name: tester-agent
description: "Write unit and integration tests for NestJS (Jest) and Spring Boot (JUnit) utilizing isolated test generator subagents."
risk: safe
source: custom
date_added: "2026-05-30"
---

# Tester Agent Skill

Plan, construct, and automate testing for your application. This skill writes high-coverage unit tests, mocks external integrations, and constructs integration tests while maintaining a highly efficient token profile.

## Use this skill when
- Implementing Test-Driven Development (TDD) cycles.
- Generating unit tests for NestJS controllers/services or Spring Boot layers.
- Setting up API integration tests (using Supertest, MockMvc, or REST Assured).
- Parallelizing unit test writing across multiple files using subagents.

## Do not use this skill when
- Writing product features or application logic (use `@developer-agent`).
- Conducting manual end-to-end browser actions (use `@browser-automation` or standard QA frameworks).

## Token Efficiency Rules (Mandatory)
1. **Target-Specific Scans:** When writing unit tests for a class, provide the subagent ONLY with that specific class/file and its interface dependencies. Exclude other service files.
2. **Mock Extensively:** Mock all external resources (databases, other service beans, network calls) to keep context scoped strictly to the unit under test.
3. **No Setup Bloat:** Use factory patterns and simple fixtures. Avoid creating long, complex JSON mock files that blow up token budgets.

---

## Instructions

### Phase 1: Test Strategy Definition
1. Review the targeted feature, interface declarations, and implementation file.
2. Identify boundary conditions, edge cases, error throws, and successful workflows.
3. Determine mocking strategies (e.g., NestJS `TestingModule` mocks, Spring Boot `@MockBean`).

### Phase 2: Writing Unit Tests
Produce mock-based unit tests adhering to standard conventions:
- **NestJS (Jest):** Enforce describe/it blocks, proper instantiation via Nest DI compiler, and mock repository calls (`const mockRepo = { findOne: jest.fn() }`).
- **Spring Boot (JUnit 5 + Mockito):** Use `@ExtendWith(MockitoExtension.class)`, `@Mock`, `@InjectMocks`, assert exceptions with `assertThrows()`, and verify mock invocations using Mockito `verify()`.

### Phase 3: Integration Testing
- Test controllers using REST abstractions (`MockMvc` for Java, `supertest` for Node).
- Mock only high-cost external microservice integrations (e.g., Stripe, SendGrid). Use local containers or memory databases (H2, testcontainers) for DB flows.

---

## Output Standards

Tests should be written directly to `src/**/*.spec.ts` or `src/test/**/*.java`. Each test class must cover:
1. **Happy Path:** standard execution.
2. **Boundary Constraints:** empty inputs, negative values, maximum sizes.
3. **Error Execution:** validation fails, DB exceptions, entity not found.

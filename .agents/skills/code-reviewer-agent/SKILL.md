    ---
name: code-reviewer-agent
description: "Audit changed code for architecture alignment, security vulnerabilities, auth/access-control flaws, API consistency, and style violations."
risk: safe
source: custom
date_added: "2026-05-30"
---

# Code Reviewer Agent Skill

Act as a strict code gatekeeper, validating new and modified source code against system architectures, security baselines, and performance rules. Reviews are conducted with extreme token efficiency by focusing purely on diffs.

## Use this skill when
- Reviewing Pull Requests or local changes before merging.
- Auditing endpoints for authentication and authorization gaps (e.g. IDOR, RBAC, OAuth2).
- Verifying code quality, framework standards, lint compliance, and architecture alignment.

## Do not use this skill when
- Making database adjustments or writing feature code.
- Generating unit or integration tests (delegated to `@tester-agent`).

## Token Efficiency Rules (Mandatory)
1. **Diff Focus:** Never read whole files unless there is an import conflict. Perform reviews by analyzing `git diff` outputs or only target modified lines.
2. **Short Checklists:** Apply targeted checking frameworks. Avoid verbose feedback; provide highly concise, actionable code suggestions.

---

## Instructions

### Phase 1: Context Definition & Scope Check
1. Read the feature proposal or `implementation_plan.md` to understand context.
2. Retrieve the codebase diff (`git diff HEAD~1` or local changes).
3. Identify modified routing, security controllers, database models, or core business logics.

### Phase 2: Security & Authentication Audit
Ensure strict security constraints:
- **Authorization Gates:** Check that every new endpoint has security annotations (`@PreAuthorize` in Spring, `@UseGuards(JwtAuthGuard)` or custom RBAC guards in NestJS).
- **IDOR Testing:** Verify that resource IDs are checked against the authenticated user (e.g. check if user ID owns resource ID before updating).
- **Injection Defenses:** Ensure all database queries utilize prepared statements or ORM parameters to block SQL Injections. Validate NestJS `class-validator` settings.
- **Secrets Check:** Enforce that API keys, passwords, or salts are never hardcoded.

### Phase 3: Clean Code & Performance Review
- **SOLID Verification:** Check if single-responsibility is breached.
- **Resource Management:** Check for open DB connections, unclosed file streams, or CPU bottlenecks.
- **DRY Violation:** Highlight copy-paste sections. Suggest creating modular shared components.
- **Exception Handling:** Verify exceptions are caught and logged using secure, mask-protected patterns (never log PII or raw SQL stack traces to the user).

---

## Output Review Template

Format code reviews as a structured, brief checklist:

```markdown
# Code Review: [Feature/PR Name]

## 1. Security & Auth Audit
- [ ] **Critical Guard Missing:** `path/to/controller.ts#L45` is missing authorization. Fix: add `@UseGuards(RolesGuard)`.
- [ ] **SQL Injection Risk:** [Fixed/Pass]
- [ ] **IDOR Risk:** [Fixed/Pass]

## 2. Architecture & Clean Code Compliance
- [ ] **DRY Violation:** Logic at `path/to/service.java#L12` duplicates `other/service.java#L80`. Suggest refactoring to a utility method.
- [ ] **Code Smells:** [Pass]

## 3. Actionable Code Suggestions
```diff
-  const result = await this.db.query("SELECT * FROM users WHERE id = " + userId);
+  const result = await this.db.query("SELECT * FROM users WHERE id = $1", [userId]);
```
```

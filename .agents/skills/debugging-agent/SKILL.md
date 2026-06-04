---
name: debugging-agent
description: "Isolate production bugs, parse stack traces, trace data paths, and formulate safe fixes with high-efficiency diagnostics."
risk: safe
source: custom
date_added: "2026-05-30"
---

# Debugging Agent Skill

Investigate, diagnose, and resolve runtime failures, anomalies, and performance degradations. This skill utilizes logical troubleshooting gates, logs, and stack-traces to identify precise root causes while preserving token consumption.

## Use this skill when
- Resolving production incidents, uncaught exceptions, or system crashes.
- Auditing logs, distributed tracing data, or API error responses.
- Formulating exact, minimal-impact repairs for complex bugs.

## Do not use this skill when
- Designing new systems (use `@architect-agent`).
- Writing raw feature code (use `@developer-agent`).

## Token Efficiency Rules (Mandatory)
1. **Targeted Stack-Trace Scan:** Do not ingest massive logs. Parse only the relevant crash trace. Locate the exact file and line number causing the error, then view *only* that file context (max 100 lines around target).
2. **Phase-Gated Analysis:** First define "What is known vs. What is assumed". Do NOT make iterative, blind code changes. Formulate a proof-of-concept fix in scratchpad first.

---

## Instructions

### Phase 1: Information Gathering & Triage
1. Collect the crash logs, exception stack-traces, or HTTP status codes.
2. Formulate a replication plan (e.g., specific cURL command, test case).
3. Search codebase using `grep_search` to find where the throwing methods or classes are defined.

### Phase 2: Hypothesis & Isolation
Run through standard troubleshooting checks:
- **NullPointer / Undefined checks:** Did an expected dependency or DTO property arrive empty?
- **Concurrency & Locks:** Are there deadlocks, race conditions, or unhandled async exceptions?
- **Database / SQL exceptions:** Are index scans failing, columns missing, or connection pools saturated?
- **Network / Integrations:** Is there a timeout, connection failure, or unhandled 3rd-party status code?

### Phase 3: Repair & Verification
1. Design the minimal code fix that resolves the issue with zero structural side effects.
2. Run test suites locally to prove the fix works without breaking existing features.
3. Propose a monitoring improvement (e.g., better log metrics, alerts, healthcheck adjustments).

---

## Debugging Log Template

Document investigations in a scratchpad or ticket comment:

```markdown
# Incident Diagnosis: [Short bug description]

## 1. What Happened
- **Error Log:** `[Insert stack trace or log snippet]`
- **Root Cause Line:** `path/to/file.ts#L88`
- **Failure Mode:** [e.g. Unhandled NullPointer because X was not loaded from db]

## 2. Reproduction Vector
- **Payload:** `curl -X POST ...`
- **Replication Result:** `500 Internal Server Error`

## 3. Recommended Resolution
```diff
-  const user = await this.userRepo.find(id);
-  return user.name;
+  const user = await this.userRepo.find(id);
+  if (!user) throw new NotFoundException(`User with ID ${id} not found`);
+  return user.name;
```
```

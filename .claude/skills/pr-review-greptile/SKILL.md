---
name: pr-review-greptile
description: Fetch and resolve Greptile PR comments holistically, not one-by-one. Use this when a PR has Greptile review comments or when preparing a PR for re-review.
---

# Greptile PR Review Skill

## Goal

Resolve Greptile comments in a way that minimizes follow-up comments on re-review.

## Operating rules

- Never address comments one at a time in isolation unless explicitly asked.
- First gather all Greptile comments on the PR.
- Deduplicate semantically overlapping comments.
- Group comments by root cause.
- Distinguish:
  - likely true positives
  - likely style/nit comments
  - speculative or low-confidence comments
- Prioritize correctness, regressions, typing, tests, security, and maintainability.

## Required workflow

1. Read the full PR diff and all Greptile comments.
2. Build a root-cause summary:
   - issue
   - affected files
   - likely impact
   - best minimal fix
   - possible second-order effects
3. Inspect adjacent code paths, callers, tests, and shared utilities before editing.
4. Create one coherent patch that resolves the true positives together.
5. Keep the diff minimal and avoid unrelated refactors.
6. Run validation:
   - format
   - lint
   - typecheck
   - relevant tests
7. Self-review the final diff as if you are Greptile and a strict senior reviewer.
8. Identify any remaining likely comments before requesting re-review.

## Review checklist

Check for:

- incorrect assumptions
- null/undefined handling
- async race/error cases
- stale callers after signature changes
- incomplete tests
- mismatch with repo patterns
- dead code introduced by fixes
- logging/privacy/security issues

## Output format

Provide:

1. Root-cause clusters
2. Planned fix strategy
3. Validation results
4. Remaining likely review risks

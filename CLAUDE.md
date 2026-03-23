# AlternaPick - Claude Code Guidelines

## Primary Goal

Produce mergeable code with minimal reviewer objections.
Favor correctness, explicitness, and small diffs over cleverness.

## Project Overview

Next.js 16 app (App Router) with Supabase, Tailwind CSS v4, Radix UI, and Vitest.
TypeScript strict mode. ESLint with `--max-warnings=0` in CI.

## General Standards

- Follow existing repo patterns before inventing new ones.
- Keep changes tightly scoped to the requested task. Do not do unrelated refactors.
- Avoid `any`, non-null assertions (`!`), and lint/type suppressions unless explicitly justified.
- Prefer reusing existing utilities, helpers, and components over creating new ones.
- Resolve root causes, not just surface symptoms.

## Before Writing Code

- Inspect nearby files and similar implementations first.
- Identify local conventions for naming, typing, error handling, tests, and data flow.
- Match those conventions exactly.

## Code Quality Rules

These rules are derived from recurring review feedback. Follow them on every change.

### 1. No Code Duplication

- Extract repeated style strings, class name patterns, or JSX blocks into constants or components.
- If the same Tailwind class combination appears in 2+ places, extract it into a `const`.
- If the same JSX pattern appears in 2+ render paths, extract a shared component or helper.
- When fixing duplication, ensure the extracted version covers all variants (animated/non-animated, hover/active states, etc.).

### 2. Guard Existing State Before Overriding

- Before setting a value (result, status, trending), check if it's already been resolved.
- New conditional branches must not clobber state that downstream code relies on.
- Trace through all existing code paths with concrete scenarios (resolved pick, unresolved pick, each result state) before adding new logic.
- Place new branches in the correct order relative to existing fallbacks.

### 3. Handle Errors Properly - Never Swallow Them

- Never use `.catch(() => {})` — always log the error using `logError` or `logWarn` from `@/lib/logger`.
- After a DB operation fails, do NOT continue to subsequent steps that depend on it. Either `return` early or `continue` to the next iteration.
- When calling `logError`, always pass the error object as the 4th argument: `logError(category, message, endpoint, error)`.
- Maintain consistent function signatures across all call sites.

### 4. Consistency Across Parallel Code Paths

- When the same operation exists in multiple code paths (e.g., `resolveCard` and `reResolveStaleCards`), apply the same guards, logging, and error handling in both.
- If you add a guard in one path, check whether the parallel path needs the same guard.
- Styling, sizing, and behavioral props must be consistent across parallel render functions (e.g., standalone links and dropdown triggers should both respect `mobileSecondaryOnly`).

### 5. No Dead Code or Unused Props

- Do not define interface fields, function parameters, or variables that are never used in any reachable code path.
- If a prop is only used conditionally (e.g., only when `animated=true`), make it optional.
- If a CSS class makes an element invisible in all contexts where it renders (e.g., `md:hidden` inside a `hidden md:contents` container), remove it.
- Remove redundant conditions that can never be false given prior guards.

### 6. Update All Related References When Renaming/Rebranding

- When changing a feature name (e.g., "Recap" -> "Wrapped"), update titles, descriptions, empty states, metadata, alt text, and any user-facing strings.
- Maintain consistent capitalization of feature names across the entire codebase.

### 7. Consider Data Volume and Query Efficiency

- When modifying Supabase queries, consider the number of rows returned.
- Prefer aggregating at the database level (RPC/SQL) over fetching all rows and aggregating in JS.
- Add `.limit()` when fetching data that could grow unboundedly.

### 8. CSS Specificity and Component Library Interactions

- When adding custom styles to Radix/shadcn components, check if component-level styles (e.g., `data-[highlighted]`) will override your classes.
- Use the same selector mechanism (e.g., `data-[highlighted]:bg-...`) to ensure your styles survive hover/focus states.
- Test both mouse hover and keyboard focus interactions.

### 9. Webhook and External Event Idempotency

- External services (Resend, Stripe, etc.) retry webhook deliveries on failure.
- Always add a unique constraint on the external event ID column.
- Use `upsert` with `{ onConflict, ignoreDuplicates: true }` to make inserts idempotent.
- Never assume a webhook event will only arrive once.

### 10. Never Silently Swallow Errors in Catch Blocks

- Bare `catch {}` or `catch () => {}` hides unexpected bugs and is banned (see rule 3).
- When degrading gracefully for a *specific* known error (e.g., missing env var), narrow the catch:
  check the error message/type before silently returning. Log unexpected errors with `logWarn`.
- This applies to `try*` wrapper functions, fire-and-forget calls, and any catch that returns a default value.

### 11. Never Log PII (Emails, Names, Tokens)

- Do not include email addresses, usernames, or auth tokens in log messages.
- Use opaque identifiers (user IDs, Resend email IDs) for debugging instead.
- PII in logs creates GDPR/privacy liability when logs are shipped to external services.

### 12. Escape User-Derived Data in Raw HTML

- When interpolating values into raw HTML strings (e.g., server-rendered pages outside React),
  always HTML-escape them (`&`, `<`, `>`, `"`) even if current callers only pass hardcoded strings.
- This prevents future XSS when a caller starts passing user-derived data.

### 13. Animation and Lifecycle Correctness

- `AnimatePresence` must stay mounted to observe child removal and play exit animations.
- Do not conditionally render `AnimatePresence` itself based on the same condition that controls its children.
- Use stable, unique keys for animated elements — avoid keys that resolve to the same value across different instances (e.g., `badge-undefined`).

## Diff Discipline

- Keep the diff minimal. Only change what the task requires.
- No opportunistic renames, code movement, or formatting changes.
- No new abstractions unless they clearly simplify or de-risk the change.
- Preserve existing public interfaces unless the task explicitly requires otherwise.

## Architecture Guidance

- Keep route handlers thin — put business logic in domain/service modules.
- Keep validation close to inputs (API boundaries, form handlers).
- Keep persistence concerns (Supabase queries) out of UI components.

## Unsafe Shortcuts to Avoid

- Don't silence lint or type errors just to pass checks.
- Don't patch only the exact failing line if the root cause is broader.
- Don't follow broken existing patterns when they clearly conflict with current standards.
- Don't log secrets or sensitive data (tokens, keys, PII).

## Pre-Push Verification (MANDATORY)

Before pushing, ALWAYS run these checks against the full codebase — not just staged files:
```bash
npx eslint src/ --max-warnings=0
npx tsc --noEmit
```
Do NOT push if either fails. This catches issues that lint-staged misses (e.g., files already on the branch but not in the current commit).

## Pre-Commit Checklist

Before committing, self-review for:
- [ ] No duplicated style strings, logic blocks, or JSX patterns
- [ ] All error paths either return/continue or log meaningfully
- [ ] New conditional branches don't override already-resolved state
- [ ] Parallel code paths have consistent guards and logging
- [ ] No unused props, variables, imports, or unreachable conditions
- [ ] All user-facing strings are consistent (capitalization, feature names)
- [ ] Supabase queries won't fetch unbounded data
- [ ] Radix/shadcn style overrides survive hover/focus states
- [ ] Null/undefined and edge cases are handled
- [ ] Async and error states are handled
- [ ] API contracts remain correct (types match runtime data)
- [ ] No hidden regressions in adjacent flows
- [ ] No secrets or sensitive data logged (no emails, names, or tokens in log messages)
- [ ] Webhook/external event handlers are idempotent (unique constraints, upsert)
- [ ] Catch blocks are narrowed to expected errors — unexpected errors are logged
- [ ] Raw HTML interpolation uses escapeHtml for any potentially user-derived values
- [ ] If something cannot be validated, say exactly what was not checked

## Tech Stack Details

- Logger: Use `logError`, `logWarn`, `logInfo` from `@/lib/logger` — never raw `console.*` (enforced by ESLint `no-console` rule)
- Testing: Vitest with `@testing-library/react`
- Styling: Tailwind CSS v4 with `tailwind-merge` and `clsx`
- UI Components: Radix UI via shadcn
- Animation: `motion` (Framer Motion)

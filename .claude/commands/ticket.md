# Ticket Management

Manage the project backlog in `.claude/backlog/tickets.json`.

## Input

The user may provide: a title, description, or a command like "close AP-5", "update AP-3 status to in_review", etc.

## Ticket Schema

Each ticket has:
- `id`: Auto-assigned (AP-001, AP-002, ...)
- `title`: Short summary (under 80 chars)
- `description`: Detailed context, reproduction steps, or acceptance criteria
- `size`: T-shirt size — `XS`, `S`, `M`, `L`, `XL`
- `priority`: `P0` (critical/blocking), `P1` (high), `P2` (medium), `P3` (nice-to-have)
- `status`: `backlog`, `in_progress`, `in_review`, `done`, `wont_fix`
- `pr`: PR number if one exists (e.g. `#108`)
- `branch`: Branch name if work has started
- `tags`: Array of tags like `bug`, `feature`, `mobile`, `ux`, `perf`, `seo`, `admin`
- `created`: ISO date
- `updated`: ISO date
- `notes`: Optional array of timestamped notes

## Operations

Based on user input, perform ONE of these:

### Add a ticket
1. **Research first**: Before writing the ticket, search the codebase for relevant context:
   - Use Grep/Glob/Read directly (do NOT use Agent — it spawns a subprocess that re-prompts for permissions)
   - Identify the specific code locations that would need to change
   - Look for existing patterns, prior art, or related implementations
   - Note any edge cases, gotchas, or dependencies discovered during research
2. Read `.claude/backlog/tickets.json`
3. Assign the next ID (AP-{next_id} zero-padded to 3 digits)
4. Increment `next_id`
5. Infer `size`, `priority`, and `tags` from context if not explicitly provided
6. Write a **detailed description** that includes:
   - **Context**: Why this matters, what user-facing problem it solves
   - **Current behavior**: What happens now (with specific file paths and line numbers from your research)
   - **Expected behavior**: What should happen instead
   - **Implementation notes**: Key files to change, approach suggestions, relevant patterns in the codebase
   - **Edge cases**: Anything tricky discovered during research
   - **Test cases**: What tests should be written or updated (specific scenarios to cover)
   - **Dev notes**: Gotchas, dependencies, things to watch out for
   The goal: someone picking this up months later should have enough context to start immediately without re-doing the research.
7. Set `status` to `backlog` unless specified
8. Write the updated JSON
9. Regenerate `.claude/backlog/tickets.js` (see "Syncing the dashboard" below)
10. Confirm: "Created **AP-XXX**: {title} ({size}, {priority})"

### Update a ticket
Parse what the user wants to change. Common patterns:
- "close AP-5" → set status to `done`
- "AP-3 is in progress on branch fix/thing" → set status to `in_progress`, set branch
- "AP-7 PR #112" → set `pr` to `#112`, set status to `in_review`
- "AP-2 is XL not M" → update size
- "add note to AP-4: decided to defer this" → append to notes array

### Bulk add
If the user provides multiple items (numbered list, bullet points), create all of them in one pass.

### List / Search
If the user says "show tickets", "what's in progress", "show P0s", etc., read the JSON and display a filtered table. Use the same format as `/backlog`.

### Sync with GitHub
If the user says "sync", "sync tickets", or "check PRs":
1. Read `tickets.json`
2. For every ticket with a `pr` field and `status: "in_review"`, check if the PR is merged:
   ```bash
   gh pr view <number> --json state --jq '.state'
   ```
3. If the PR state is `MERGED`, set `status: "done"` and set `updated` to today
4. Write the updated JSON + regenerate `tickets.js`
5. Report what changed:
   ```
   Synced with GitHub:
     AP-004 (#112): in_review → done (merged)
     AP-007 (#114): in_review (still open)
   ```

## Lifecycle transitions

When working on tickets outside of this command (e.g., creating branches, pushing PRs), proactively update the ticket status:
- Creating a branch for a ticket → set `status: "in_progress"`, set `branch`
- Opening a PR for a ticket → set `pr`, set `status: "in_review"`
- PR merged → set `status: "done"` (only the user transitions to done, or use `sync` below)
- Multiple tickets in one PR → update all of them

**Important**: When Claude creates a PR, the ticket goes to `in_review` — NOT `done`. Only mark `done` when the PR is actually merged.

## Syncing the dashboard

After ANY mutation to `tickets.json`, regenerate `.claude/backlog/tickets.js` so the HTML dashboard stays in sync:

```bash
cd .claude/backlog && cat tickets.json | python3 -c "import sys,json; d=json.load(sys.stdin); print('window.__TICKETS__ = ' + json.dumps(d, indent=2) + ';')" > tickets.js
```

The dashboard (`index.html`) loads `tickets.js` via a `<script>` tag (works with `file://` protocol). It does NOT read `tickets.json` directly.

## Guidelines

- Always read the current JSON before writing to avoid clobbering
- Keep titles concise — put detail in description
- Infer tags from content (e.g. "mobile" if they mention phone/touch, "bug" if it's broken behavior)
- When updating, preserve all fields not being changed
- After any mutation, display the affected ticket(s) in a compact summary
- Always set `updated` to today's date when modifying a ticket
- **Research is mandatory for new tickets**: Always search the codebase before writing. Include file paths, line numbers, and specific findings in the description. A ticket without code context is incomplete.
- **Write for future-you**: Assume the ticket may be picked up weeks or months later by someone with no prior context. Include enough detail that they can start working immediately.
- **Include test cases**: Every ticket should mention what tests to write or update. Think about: happy path, error cases, edge cases, regression scenarios.
- **Note dependencies**: If the ticket depends on or conflicts with other tickets, note it. If a code change would affect multiple systems, list them.

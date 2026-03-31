# View Backlog

Display the current project backlog from `.claude/backlog/tickets.json`.

## Behavior

1. Read `.claude/backlog/tickets.json`
2. Display tickets grouped by status, sorted by priority within each group
3. Use the format below

## Display Format

### Summary line
```
AlternaPick Backlog — X open, Y in progress, Z done
```

### Status groups (only show non-empty groups)

Show in this order: `in_progress`, `in_review`, `backlog`, `done`

For each ticket in a group, show one line:
```
AP-XXX  [SIZE] [PRIORITY] Title                              #PR  branch
```

Use these priority indicators:
- P0: `!!!`
- P1: `!! `
- P2: `!  `
- P3: `   `

### Optional filters

If the user says `/backlog P0` or `/backlog bugs` or `/backlog mobile`, filter accordingly:
- Priority filter: show only that priority
- Tag filter: show only tickets with that tag
- Status filter: e.g. `/backlog done` shows completed tickets

### HTML output

If the user says `/backlog html`, generate `.claude/backlog/index.html` with a styled view of the backlog:
- Dark theme matching AlternaPick's aesthetic
- Grouped by status with collapsible sections
- Color-coded priority badges
- Size badges
- Tag pills
- PR links (to github.com/aafarian/AlternaPick/pull/XXX)
- Auto-refreshes from tickets.json via a script tag (for local dev)

After generating, tell the user: "Open `.claude/backlog/index.html` in your browser to view."

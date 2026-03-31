window.__TICKETS__ = {
  "project": "AlternaPick",
  "prefix": "AP",
  "next_id": 26,
  "tickets": [
    {
      "id": "AP-001",
      "title": "My Picks page shows \"H2H [first person]\" for group challenges",
      "description": "Group challenges display as 'H2H antotest' on the My Picks page even with 6 players. Should show something like 'Group (6 players)' or list participant names.",
      "size": "S",
      "priority": "P1",
      "status": "done",
      "pr": "#108",
      "branch": "fix/picks-challenge-labels",
      "tags": [
        "bug",
        "ux",
        "group-challenge"
      ],
      "created": "2026-03-28",
      "updated": "2026-03-28",
      "notes": []
    },
    {
      "id": "AP-002",
      "title": "My Picks page shows \"H2H undefined\" for email invite challenges",
      "description": "Email invite challenges where opponent_id was null at card creation show 'H2H undefined' on the My Picks page. Need to handle the null opponent case (show email or 'Invited opponent').",
      "size": "S",
      "priority": "P1",
      "status": "done",
      "pr": "#108",
      "branch": "fix/picks-challenge-labels",
      "tags": [
        "bug",
        "ux",
        "email-challenge"
      ],
      "created": "2026-03-28",
      "updated": "2026-03-28",
      "notes": []
    },
    {
      "id": "AP-003",
      "title": "SEO, Open Graph image, and favicon improvements",
      "description": "AlternaPick doesn't appear in Google search results. Shared links (text message, Facebook, etc.) look terrible \u2014 no preview image or description. Favicon is bad. Mobile PWA icon shows generic 'AP'. Need: proper meta tags, OG image, sitemap, favicon redesign, and Apple touch icon.",
      "size": "M",
      "priority": "P1",
      "status": "done",
      "pr": "#116",
      "branch": "feat/seo-favicon-improvements",
      "tags": [
        "feature",
        "seo",
        "ux"
      ],
      "created": "2026-03-28",
      "updated": "2026-03-28",
      "notes": []
    },
    {
      "id": "AP-004",
      "title": "Notifications stack on top of each other when switching tabs",
      "description": "When switching back to a tab after multiple notifications arrived, toasts all render simultaneously and overlap/squish. Need to queue or debounce toast notifications that arrive in rapid succession.",
      "size": "S",
      "priority": "P2",
      "status": "done",
      "pr": "#112",
      "branch": "fix/toast-stacking",
      "tags": [
        "bug",
        "ux"
      ],
      "created": "2026-03-28",
      "updated": "2026-03-29",
      "notes": []
    },
    {
      "id": "AP-005",
      "title": "Enforce card_size constraint across all challenge participants",
      "description": "If the challenger picks 6 props, the opponent should be forced to also pick 6 (shown as '0/6'). Currently a user can lock in at 4/6 if they started independently. The card_size on the challenge should be the constraint for all participants. Show 'Lock in X picks' for unconstrained solo cards, but 'X/Y' when constrained by a challenge.",
      "size": "M",
      "priority": "P0",
      "status": "done",
      "pr": "#111",
      "branch": "fix/card-size-constraint",
      "tags": [
        "bug",
        "challenge"
      ],
      "created": "2026-03-28",
      "updated": "2026-03-29",
      "notes": []
    },
    {
      "id": "AP-006",
      "title": "Sort lobby participants: locked-in players at top",
      "description": "In the group challenge lobby, participants who have locked in their picks should be grouped at the top. Players who haven't locked in should be grouped at the bottom, not sprinkled between locked-in players.",
      "size": "XS",
      "priority": "P2",
      "status": "done",
      "pr": "#109",
      "branch": "fix/lobby-sort-locked-first",
      "tags": [
        "ux",
        "group-challenge"
      ],
      "created": "2026-03-28",
      "updated": "2026-03-28",
      "notes": []
    },
    {
      "id": "AP-007",
      "title": "Live scoring should work regardless of challenge status",
      "description": "Games that have started don't show live scores until the challenge is manually 'started'. User had to click 'Start Challenge' to trigger scoring even though games were already live. Scoring should activate based on game commence_time, not challenge status. This is a fundamental issue with the live scoring architecture.",
      "size": "L",
      "priority": "P0",
      "status": "done",
      "pr": "#114",
      "branch": "fix/group-live-scoring-and-start-removal",
      "tags": [
        "bug",
        "scoring",
        "group-challenge"
      ],
      "created": "2026-03-28",
      "updated": "2026-03-29",
      "notes": []
    },
    {
      "id": "AP-008",
      "title": "Remove 'Start Early' mechanic from group challenges",
      "description": "The 'Start Challenge Early' button is confusing and broken: it doesn't lock people out (a 6th person joined after starting with 5), and the main need it addresses (live scoring) should work automatically. Remove the start-early button. Challenges auto-activate when all non-declined participants lock in, or when games start (whichever comes first). Keep cancel functionality. Late joiners after all games have started should be blocked.",
      "size": "L",
      "priority": "P0",
      "status": "done",
      "pr": "#114",
      "branch": "fix/group-live-scoring-and-start-removal",
      "tags": [
        "feature",
        "group-challenge"
      ],
      "created": "2026-03-28",
      "updated": "2026-03-29",
      "notes": [
        "AP-007 and AP-008 are closely related and should likely be done together"
      ]
    },
    {
      "id": "AP-009",
      "title": "Add/remove people from active group challenges",
      "description": "New feature: (1) Invite more people to an existing challenge from the lobby. (2) Remove a participant so they can re-do picks. (3) Allow any participant to invite others (gated by permission later). (4) Allow invites beyond max \u2014 show 'lobby full' if max reached when they try to accept. This is a significant engagement booster.",
      "size": "XL",
      "priority": "P2",
      "status": "done",
      "pr": "#122",
      "branch": "feat/group-lobby-invite",
      "tags": [
        "feature",
        "group-challenge",
        "engagement"
      ],
      "created": "2026-03-28",
      "updated": "2026-03-30",
      "notes": [
        "PR #120 merged with base feature. PR #122 adds InvitePanel, optimistic updates, kick loading, re-invite fix, and 59 tests."
      ]
    },
    {
      "id": "AP-010",
      "title": "Mobile: search results hidden in challenge modal overflow",
      "description": "On mobile, when picking props and tapping 'Challenge', typing a friend's name in the search box shows results that are clipped by overflow \u2014 pills are invisible and untappable. User has to abandon picks and start over from the Challenges tab.",
      "size": "S",
      "priority": "P1",
      "status": "done",
      "pr": "#110",
      "branch": "fix/mobile-search-overflow-and-banner",
      "tags": [
        "bug",
        "mobile"
      ],
      "created": "2026-03-28",
      "updated": "2026-03-29",
      "notes": []
    },
    {
      "id": "AP-011",
      "title": "Mobile: picks banner not flush with bottom of screen",
      "description": "On some mobile resolutions, the bottom picks banner floats above the actual bottom of the viewport. Cards scroll underneath and peek out below the banner. Should be fixed to the very bottom.",
      "size": "XS",
      "priority": "P2",
      "status": "done",
      "pr": "#110",
      "branch": "fix/mobile-search-overflow-and-banner",
      "tags": [
        "bug",
        "mobile"
      ],
      "created": "2026-03-28",
      "updated": "2026-03-29",
      "notes": []
    },
    {
      "id": "AP-012",
      "title": "Admin panel: active users count seems wrong",
      "description": "Admin panel showed 1 active user during a 6-person challenge session. Need to audit how 'active users for the day' is calculated \u2014 may be counting unique sign-ins instead of unique activity.",
      "size": "S",
      "priority": "P3",
      "status": "done",
      "pr": "#119",
      "branch": "fix/admin-dau-count",
      "tags": [
        "bug",
        "admin"
      ],
      "created": "2026-03-28",
      "updated": "2026-03-29",
      "notes": []
    },
    {
      "id": "AP-013",
      "title": "Wrapped stats are inaccurate (wrong pick counts and hit rates)",
      "description": "Wrapped page shows '#1 pick of the week \u2014 Kawhi Leonard \u2014 8 picks, 75% hit' but clicking through reveals far more picks and lower hit rate. May be pulling all-time stats instead of weekly, or the aggregation query is filtering incorrectly.",
      "size": "M",
      "priority": "P1",
      "status": "done",
      "pr": "#113",
      "branch": "fix/wrapped-player-picks-date-range",
      "tags": [
        "bug",
        "wrapped"
      ],
      "created": "2026-03-28",
      "updated": "2026-03-29",
      "notes": []
    },
    {
      "id": "AP-014",
      "title": "Audit and remove silent error swallowing in data-fetching helpers",
      "description": "Several server-side data-fetching functions (e.g., getCardsByStatus in picks/page.tsx) log errors but return empty arrays, making broken queries indistinguishable from 'no data'. This caused the finished cards bug (#115) where a bad column name in CARD_SELECT silently broke every card list query. Audit all patterns where a Supabase query error is caught/logged but returns a default value ([], null, 0). Page-level fetches should throw or surface error state to the UI. Fire-and-forget side effects (notifications, analytics) can still degrade gracefully with logging.",
      "size": "M",
      "priority": "P2",
      "status": "done",
      "pr": "#117",
      "branch": "fix/surface-data-fetch-errors",
      "tags": [
        "tech-debt",
        "reliability"
      ],
      "created": "2026-03-28",
      "updated": "2026-03-28",
      "notes": [
        "Would have prevented #115 \u2014 tests exercising these paths would fail loudly instead of passing with empty data"
      ]
    },
    {
      "id": "AP-015",
      "title": "Remove card_size picker from challenge modal; set on lock-in",
      "description": "Currently the challenge modal lets the challenger pre-select how many picks the challenge will have. Instead: (1) Remove the card_size selector from the challenge modal entirely. (2) The challenge should be sent/created when the challenger clicks 'Lock in'. (3) The challenger can lock in with any number of picks (1-6). (4) card_size is set automatically based on how many picks the challenger actually locked in, so opponents get the accurate constraint. This ensures the card_size always matches reality.",
      "size": "M",
      "priority": "P1",
      "status": "done",
      "pr": "#123",
      "branch": "feat/card-size-on-lockin",
      "tags": [
        "feature",
        "challenge",
        "ux"
      ],
      "created": "2026-03-29",
      "updated": "2026-03-30",
      "notes": []
    },
    {
      "id": "AP-016",
      "title": "Fix 6 silent .catch(() => {}) error swallowing patterns",
      "description": "Audit found 6 bare .catch(() => {}) blocks that violate CLAUDE.md rule 10. All should log with logWarn at minimum:\n1. src/lib/cards/resolution.ts (lines 111, 1220) \u2014 notification after card resolve\n2. src/app/challenges/page.tsx (lines 133, 140, 225-226) \u2014 debounced fetches on realtime reconnect\n3. src/components/layout/NotificationBell.tsx (line 92) \u2014 mark_all_read API call\n4. src/components/pwa/ServiceWorkerRegistration.tsx (line 8) \u2014 SW registration\n5. src/app/auth/login/page.tsx (line 75) \u2014 claimCardsAfterLogin\n6. src/app/auth/signup/page.tsx (line 97) \u2014 claimCardsAfterLogin\nFire-and-forget is fine, but failures must be logged.",
      "size": "S",
      "priority": "P2",
      "status": "backlog",
      "pr": "",
      "branch": "",
      "tags": [
        "tech-debt",
        "reliability"
      ],
      "created": "2026-03-30",
      "updated": "2026-03-30",
      "notes": [
        "Closely related to AP-014 which fixed the server-side data-fetching variant"
      ]
    },
    {
      "id": "AP-017",
      "title": "Fix ~12 logError calls missing the error object parameter",
      "description": "Multiple logError calls pass only (category, message) but omit the error object as the 4th argument. Per CLAUDE.md rule 3: 'When calling logError, always pass the error object as the 4th argument: logError(category, message, endpoint, error)'. Primary offender: src/lib/challenges/resolution.ts (lines 82, 134, 360, and ~9 more). Also check src/lib/api/errors.ts which defines a separate logError with a different signature \u2014 consider consolidating or renaming to avoid confusion.",
      "size": "S",
      "priority": "P2",
      "status": "backlog",
      "pr": "",
      "branch": "",
      "tags": [
        "tech-debt",
        "reliability"
      ],
      "created": "2026-03-30",
      "updated": "2026-03-30",
      "notes": [
        "Can be combined with AP-016 in a single PR"
      ]
    },
    {
      "id": "AP-018",
      "title": "Add production error reporting (Sentry or similar)",
      "description": "Currently errors only go to console and an in-memory ring buffer (100 entries, viewable on admin dashboard). No persistent error tracking \u2014 if the server restarts or the buffer fills up, errors are lost. No client-side error capture at all. Should:\n1. Integrate Sentry (or similar) for both server and client errors\n2. Wire up global-error.tsx and route-level error.tsx boundaries to report errors\n3. Capture unhandled promise rejections\n4. Add source maps for meaningful stack traces\n5. Add user context (user_id, not PII) for error grouping\nThis is the single biggest reliability gap \u2014 we're flying blind in production.",
      "size": "L",
      "priority": "P1",
      "status": "backlog",
      "pr": "",
      "branch": "",
      "tags": [
        "feature",
        "reliability",
        "infra"
      ],
      "created": "2026-03-30",
      "updated": "2026-03-30",
      "notes": [
        "Error boundaries exist for all 14 routes + global, but none report to external services. Sentry has a Next.js SDK with automatic instrumentation."
      ]
    },
    {
      "id": "AP-019",
      "title": "Audit test coverage and add testing guidelines to CLAUDE.md",
      "description": "Current state: 537 tests across 21 files, all unit tests (Vitest, node env). No component tests (.tsx), no E2E tests, no API route integration tests. Coverage is concentrated in lib/ (business logic, validation, resolution) with zero coverage on UI components and API routes. Should:\n1. Run vitest with coverage reporting to identify uncovered critical paths\n2. Add testing guidelines to CLAUDE.md (when to write tests, what to test, mocking patterns)\n3. Evaluate adding Playwright for E2E smoke tests on critical flows (login \u2192 pick props \u2192 lock in \u2192 challenge resolves)\n4. Consider adding API route tests for the most complex endpoints (challenges PATCH with 5 action types)\n5. Document the existing Supabase proxy-mock pattern so new tests follow the same convention",
      "size": "L",
      "priority": "P2",
      "status": "backlog",
      "pr": "",
      "branch": "",
      "tags": [
        "tech-debt",
        "testing"
      ],
      "created": "2026-03-30",
      "updated": "2026-03-30",
      "notes": [
        "21 test files exist: challenges (8), cards (3), email (2), sports (1), achievements (1), odds-api (1), format (1), validation (1), games API (1), stats-service integration (1, conditional)"
      ]
    },
    {
      "id": "AP-020",
      "title": "Add health check endpoint and zero-downtime deploys",
      "description": "Site went down briefly on 2026-03-30 during a deploy \u2014 likely caused by container restart gap with no health check or rolling update configured. Need to:\n1. Add a /api/health endpoint that returns 200 (can also check DB connectivity)\n2. Add HEALTHCHECK instruction to Dockerfile pointing at /api/health\n3. Configure docker-compose with `deploy.update_config.order: start-first` for rolling restarts\n4. Ensure the reverse proxy (if any) only routes to healthy containers\n5. Enable Cloudflare 'Always Online' as a safety net for origin downtime\n6. Consider building Docker images in CI (GitHub Actions) and pulling on Hetzner to avoid build-time memory contention with the running app",
      "size": "M",
      "priority": "P1",
      "status": "in_review",
      "pr": "#127",
      "branch": "feat/health-check-zero-downtime",
      "tags": [
        "infra",
        "reliability"
      ],
      "created": "2026-03-30",
      "updated": "2026-03-30",
      "notes": [
        "Triggered by a brief outage during deploy on 2026-03-30. Stack: Hetzner Cloud + Cloudflare + Docker."
      ]
    },
    {
      "id": "AP-021",
      "title": "Tab shows prop count but content shows \"No games available\"",
      "description": "**Context:** Users land on the props page and see e.g. 'NBA (403)' in the tab badge, but the content area below says 'No games available'. This makes the site look broken/empty and can drive users away. A refresh fixes it, indicating a stale cache or data mismatch.\n\n**Root cause:** Two independent queries feed the tab counts and the content area, and they use different time ranges:\n\n1. **Tab counts** \u2014 `getCachedPropCounts()` in `src/lib/odds-api/cache.ts:180-209` queries games with `commence_time >= now + 5 min` (the lock buffer). This is cached via `unstable_cache` for 120s.\n2. **Content data** \u2014 `getCachedProps(sport)` in `src/lib/odds-api/cache.ts:133-170` queries games with `commence_time >= now - 1 day`, also cached 120s. Then the page applies a client-side filter at `src/app/props/page.tsx:87-94` removing games within LOCK_BUFFER_MS (5 min).\n\nThe mismatch: when both caches are stale and re-execute at slightly different times (or across different request lifecycles), they capture different 'now' timestamps. The count query may see 403 props for games starting > 5 min from its 'now', but the content query's 'now' is a few seconds later, causing games right at the 5-minute boundary to be filtered out. In the worst case (e.g., a sport with only a few games near tip-off), ALL games get filtered and the content is empty while the count is still positive.\n\nAdditionally, after `revalidateTag(PROPS_CACHE_TAG)` in `src/app/api/props/sync/route.ts:63`, both caches are cleared but may repopulate at different times \u2014 the count cache could serve a stale hit from a prior render while the content cache is freshly empty.\n\n**Expected behavior:** The tab count and content should ALWAYS be consistent. If content shows 0 games, the tab count should also show 0.\n\n**Implementation notes:**\n- **Option A (recommended):** Derive tab counts from the same filtered data used for content. In `src/app/props/page.tsx`, after applying the LOCK_BUFFER_MS filter, compute counts per sport from the filtered results. Pass these counts to `SportSelector` instead of using the separate `getCachedPropCounts()` query. This guarantees consistency because both come from the same data + filter.\n- **Option B:** Unify the time range logic. Make `getCachedPropCounts` use the exact same range as `getCachedProps` + page filter, and ensure both use the same 'now' timestamp (pass it as a parameter).\n- **Option C:** Fetch all sports' data in a single query call and derive counts from it \u2014 eliminates the two-query problem entirely.\n\n**Key files:**\n- `src/lib/odds-api/cache.ts:180-216` \u2014 `getCachedPropCounts` (count query)\n- `src/lib/odds-api/cache.ts:133-178` \u2014 `getCachedProps` (content query)\n- `src/app/props/page.tsx:87-94` \u2014 LOCK_BUFFER_MS page-level filter\n- `src/app/props/page.tsx:125-134` \u2014 'No games available' empty state\n- `src/components/props/SportSelector.tsx:7-44` \u2014 tab component that displays counts\n- `src/lib/challenges/constants.ts:8` \u2014 LOCK_BUFFER_MS = 5 * 60 * 1000\n- `src/app/api/props/sync/route.ts:63` \u2014 cache invalidation via revalidateTag\n\n**Edge cases:**\n- All games for a sport start within 5 minutes (count > 0 but content empty)\n- Cache invalidation during page render (count stale, content fresh or vice versa)\n- Tab switch via `router.push` re-renders with new searchParams but may hit cached data from different timestamps\n\n**Test cases:**\n- Unit: When all games for a sport are within LOCK_BUFFER_MS, tab count should be 0\n- Unit: Tab counts derived from filtered data match the number of props shown in content\n- Unit: After cache invalidation, counts and content are consistent on next render\n- Integration: Switching tabs preserves count/content consistency\n\n**Dev notes:**\n- Prior race condition fix in commit 16279b4 removed a `Promise.race` timeout that caused similar symptoms\n- Commit ca278ae fixed caching DB errors as empty state for 120s \u2014 related pattern\n- The 120s `unstable_cache` revalidation means the bug can persist for up to 2 minutes after games cross the lock boundary",
      "size": "M",
      "priority": "P0",
      "status": "done",
      "pr": "#124",
      "branch": "fix/props-tab-count-consistency",
      "tags": [
        "bug",
        "ux",
        "props"
      ],
      "created": "2026-03-30",
      "updated": "2026-03-30",
      "notes": [
        "User-reported: 'can drive people away thinking there's no content on the site'. This is the highest-impact UX bug currently open."
      ]
    },
    {
      "id": "AP-022",
      "title": "Clicking participant box on challenge page scrolls to their card",
      "description": "**Context:** On challenge pages, the top section shows compact participant boxes (scores/avatars), and the detailed pick cards are below. On longer pages (especially group challenges with 4-8 players), users have to manually scroll to find a specific player's card. Clicking a participant box should smooth-scroll to that player's detailed card section.\n\n**Current behavior:** Clicking the top participant boxes does nothing. No scroll anchors or click handlers exist on these elements.\n\n**Expected behavior:** Clicking a participant's summary box (RosterTile in group, PlayerSide header in 1v1) smooth-scrolls the page to that participant's detailed pick section (ParticipantPickSection in group, LivePickCard in 1v1).\n\n**Implementation notes:**\n\n*1v1 (ChallengeMatchup):*\n- File: `src/components/challenges/ChallengeMatchup.tsx`\n- PlayerSide component (lines 42-170) renders the top summary for each player\n- The same component also contains the LivePickCard (lines 141-149)\n- Since summary and card are in the same PlayerSide, scrolling is less critical for 1v1 \u2014 but still useful on mobile where the page is vertical\n- Add `id` attributes like `id={`card-${participant.user_id}`}` to the LivePickCard wrapper\n- Add `onClick` \u2192 `scrollIntoView` to the summary section (avatar/name area)\n- Add `cursor-pointer` styling to indicate clickability\n\n*Group (GroupLobbyView):*\n- File: `src/components/challenges/GroupLobbyView.tsx`\n- RosterTile (lines 98-199) renders the compact top boxes in a grid (lines 724-754)\n- ParticipantPickSection (lines 203-320) renders the detailed cards in a grid (lines 914-945)\n- Add `id={`picks-${participant.id}`}` to each ParticipantPickSection wrapper\n- Add `onClick` handler to RosterTile that calls `document.getElementById(`picks-${participant.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })`\n- Add `cursor-pointer` class to RosterTile\n- Consider adding a small visual affordance (e.g., subtle hover effect change) to signal clickability\n\n*Existing scroll patterns in the codebase:*\n- `src/components/props/PropsGameList.tsx` uses `document.getElementById(`game-${gameId}`).scrollIntoView({ behavior: 'smooth', block: 'start' })`\n- `src/components/props/DateNavigator.tsx` uses `ref.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })`\n- Follow the `getElementById` + `scrollIntoView` pattern for consistency\n\n**Edge cases:**\n- Participant has no card yet (waiting state) \u2014 still scroll to the empty placeholder section\n- Participant's picks are hidden (privacy guard) \u2014 scroll to the locked picks message\n- On mobile, RosterTile already has a click target for kick button (host only) \u2014 ensure scroll doesn't conflict with kick button clicks (use `e.stopPropagation()` on kick button)\n- Smooth scroll should account for sticky header offset (~64px)\n\n**Test cases:**\n- Click RosterTile \u2192 page scrolls to that participant's ParticipantPickSection\n- Click RosterTile for participant with no card \u2192 scrolls to waiting placeholder\n- Click kick button inside RosterTile \u2192 does NOT trigger scroll (event propagation stopped)\n- 1v1: Click PlayerSide header \u2192 scrolls to LivePickCard section\n- Verify scroll offset accounts for sticky nav\n\n**Dev notes:**\n- The `block: 'start'` option may need `scroll-margin-top` CSS on the target elements to offset the sticky header\n- Consider using `scroll-mt-20` (Tailwind) on ParticipantPickSection wrapper to handle the 64px sticky header",
      "size": "S",
      "priority": "P2",
      "status": "backlog",
      "pr": "",
      "branch": "",
      "tags": [
        "feature",
        "ux"
      ],
      "created": "2026-03-30",
      "updated": "2026-03-30",
      "notes": []
    },
    {
      "id": "AP-023",
      "title": "Reusable user profile popover for player icons/names app-wide",
      "description": "**Context:** Currently, clicking a player icon/name behaves differently depending on where you are in the app. In the friends strip (`FriendsStrip.tsx`), it opens a dropdown with View Profile / Challenge / Unfriend. In the leaderboard, it navigates to their profile page. In challenge pages, group lobbies, friend requests, and share pages, icons are not clickable at all. Users should be able to tap any player icon/name anywhere and get a consistent interaction menu.\n\n**Current behavior:**\n- `FriendsStrip.tsx` (lines 68-120): Opens a Radix DropdownMenu with 3 items \u2014 View Profile (`/users/{username}`), Challenge (`/challenges?opponent={id}`), Unfriend (API call). This is the gold-standard interaction but it's inlined and not reusable.\n- `FriendsList.tsx` (lines 54-70): Wraps avatar+name in a `Link` to `/users/{username}`. No menu.\n- `LeaderboardRow.tsx` (lines 78-85, 132-139): Wraps avatar in a `Link` to `/users/{username}` or `/profile` (self).\n- `GroupLobbyView.tsx` RosterTile (lines 98-199): Avatar is static, not clickable.\n- `ChallengeMatchup.tsx` PlayerSide (lines 42-170): Avatar is static, not clickable.\n- `ActiveChallengeCard.tsx`, `IncomingChallengeCard.tsx`, `HistoryChallengeCard.tsx`: Avatar is inside a Link that wraps the entire card \u2014 no individual interaction.\n- `FriendRequestCard.tsx` (lines 113-119, 173-179): Avatar is static.\n- Share pages (`picks/share/[token]/page.tsx`, `challenges/[id]/share/page.tsx`): Static.\n- `ProfileCard.tsx`, `ProfileSection.tsx`: Own profile, static (makes sense).\n\n**Expected behavior:** A single reusable `<UserProfilePopover>` component that wraps any user avatar/name and provides a consistent context menu on click. Menu items adapt based on context:\n- **View Profile** \u2014 always shown (navigates to `/users/{username}`)\n- **Challenge** \u2014 shown if the user is not yourself\n- **Add Friend / Unfriend** \u2014 shown based on friendship status (requires a lightweight check)\n- **Remove from Challenge** \u2014 shown only if in a challenge lobby context where the current user is host\n\n**Implementation notes:**\n\n*New component: `src/components/shared/UserProfilePopover.tsx`*\n- Use Radix `Popover` or `DropdownMenu` (match FriendsStrip pattern)\n- Props:\n  ```typescript\n  interface UserProfilePopoverProps {\n    userId: string;\n    username: string;\n    avatarUrl?: string | null;\n    iconConfig?: Record<string, unknown> | null;\n    children: ReactNode; // The trigger (avatar, name, or both)\n    disabled?: boolean; // For own profile, share pages, etc.\n  }\n  ```\n- Internally fetches friendship status on open (not on mount \u2014 lazy) via a lightweight API call or cached context\n- Menu items: View Profile, Challenge, Add Friend/Unfriend (conditionally)\n- When `disabled` or `userId` matches current user, renders children without popover wrapper\n\n*Adoption plan (incremental):*\n1. Create the component + test it standalone\n2. Refactor `FriendsStrip.tsx` to use it (replace inline DropdownMenu)\n3. Refactor `FriendsList.tsx` to use it (replace Link wrapper)\n4. Add to `LeaderboardRow.tsx` (replace Link wrapper)\n5. Add to `GroupLobbyView.tsx` RosterTile avatars\n6. Add to `ChallengeMatchup.tsx` PlayerSide avatars\n7. Add to `FriendRequestCard.tsx` avatars\n8. Skip share pages and own-profile pages (disabled or not applicable)\n\n*Data requirements:*\n- All locations already have `userId`, `username`, `avatar_url`, `icon_config` available\n- Friendship status is NOT available at most locations \u2014 need a lightweight fetch or a `useFriendshipStatus(userId)` hook that checks `/api/friends/status?user_id=X`\n- A new API endpoint `GET /api/friends/status?user_id=X` returning `{ status: 'friends' | 'pending' | 'none' }` would keep the popover fast\n\n*Existing patterns to follow:*\n- `PlayerProfileSheet` + `usePlayerProfile()` context (in `src/lib/players/player-profile-context.tsx`) \u2014 this is the pattern for sports player profiles. The user profile popover is the equivalent for AlternaPick users.\n- `FriendsStrip.tsx` lines 68-120 \u2014 the inline DropdownMenu to refactor into the shared component\n- `OpponentAvatar.tsx` \u2014 handles the email-invite case (no userId). The popover should gracefully skip when `userId` is missing.\n\n**Edge cases:**\n- **Own profile:** Don't show popover (or show a simplified version without Challenge/Friend actions)\n- **Email invite opponents:** No userId, skip popover entirely (OpponentAvatar already handles this)\n- **Guest users (not logged in):** Show View Profile only, or skip entirely\n- **User on share page (public, no auth):** Skip popover\n- **StackedAvatars:** Multiple overlapping avatars \u2014 popover on the group is impractical. Could show popover only if there's a single avatar, or skip for stacked.\n- **Friendship status loading:** Show menu immediately with View Profile + Challenge, lazy-load the friend action\n\n**Test cases:**\n- Click avatar in leaderboard \u2192 popover opens with View Profile + Challenge\n- Click avatar in group lobby \u2192 popover opens with appropriate actions\n- Click own avatar \u2192 no popover (or simplified)\n- Click email-invite avatar (no userId) \u2192 no popover\n- Popover shows correct friendship status (friends vs not friends)\n- Challenge action navigates to `/challenges?opponent={id}`\n- View Profile navigates to `/users/{username}`\n- Unfriend calls API and updates UI\n- Multiple popovers don't stack (only one open at a time)\n\n**Dev notes:**\n- Consider using Radix `DropdownMenu` (not `Popover`) to match the existing FriendsStrip pattern and get built-in keyboard navigation + focus management\n- The `disabled` prop should render children as-is (no wrapper) to avoid layout shifts\n- Avoid fetching friendship status on every avatar mount \u2014 only fetch when the popover opens\n- This is a good candidate for a context provider (`UserPopoverProvider`) if we need to manage 'only one open at a time' state",
      "size": "M",
      "priority": "P2",
      "status": "backlog",
      "pr": "",
      "branch": "",
      "tags": [
        "feature",
        "ux",
        "component"
      ],
      "created": "2026-03-30",
      "updated": "2026-03-30",
      "notes": [
        "Supersedes the inline DropdownMenu in FriendsStrip.tsx. Incremental adoption \u2014 start with the shared component, then replace usages one by one."
      ]
    },
    {
      "id": "AP-024",
      "title": "Missing loading spinners on live score cards during initial fetch",
      "description": "**Context:** When opening a challenge page (group or 1v1), the pick cards appear immediately with stale/zero scores and no loading indicator. Users see a static card with no visual feedback that live data is being fetched. This is confusing \u2014 it looks like scoring is broken.\n\n**Current behavior:**\nThe loading skeleton logic in `LivePickCard.tsx` (lines 126-138) only shows skeletons when `loading && picks.length === 0`. But picks are already present from the server-rendered page data (they're in the DB), so `picks.length` is never 0 when the component mounts. The skeleton condition is never true, and users see picks with stale values and no spinner.\n\nThe loading flow:\n1. Page loads \u2192 server fetches challenge data including picks from DB \u2192 picks render immediately\n2. `useLiveChallenge` hook starts polling `/api/challenges/{id}/live` every 5s\n3. First poll returns live data \u2192 picks update with actual scores\n4. Between step 1 and 3, there's no visual loading indicator\n\n**Three loading indicators exist but have gaps:**\n\n1. **Header Loader2 spinner** (`GroupLobbyView.tsx` line 635-637, `ChallengeMatchup.tsx` line 432-434) \u2014 shows when `liveLoading && !liveData`. Works correctly but is small and easy to miss.\n\n2. **Pick row skeletons** (`LivePickCard.tsx` lines 126-138) \u2014 shows when `loading && picks.length === 0`. Never triggers because picks are already loaded from the server.\n\n3. **Per-pick Loader2 icon** (`LivePickRow.tsx` lines 218-220, 254-255) \u2014 shows when `isAwaitingLive = !game_status && !current_value` (computed in `pick-display.ts`). However, `toLivePickData()` now returns `status: 'scheduled'` for pre-game picks instead of null, so `isAwaitingLive` is false and the spinner doesn't show.\n\n**Expected behavior:** When live data hasn't loaded yet, each pick card should show a clear loading indicator \u2014 either:\n- A subtle overlay/opacity reduction on the card with a spinner\n- Individual pick rows showing a Loader2 spinner in the value column while awaiting live data\n- A skeleton overlay on the score/value areas only (not the whole card)\n\n**Implementation notes:**\n\n*Option A: Show per-pick loading spinners when live data hasn't arrived*\n- In `pick-display.ts`, `toLivePickData()` could set a `loading` flag when the pick has no live data yet\n- `LivePickRow.tsx` already has the Loader2 spinner pattern for `isAwaitingLive` \u2014 extend it to also trigger when live data is pending\n- Key: distinguish 'scheduled game, no live data expected' from 'active game, live data loading'\n\n*Option B: Card-level loading overlay*\n- In `LivePickCard.tsx`, add a new loading state: `loading && picks.length > 0` \u2192 show a subtle loading indicator (e.g., pulsing border, small spinner in header, or reduced opacity)\n- This is simpler and covers all cases without per-pick logic\n\n*Option C: Fix the skeleton condition*\n- Change `loading && picks.length === 0` to just `loading` and show skeletons OVER existing picks\n- This would cause a flash of content \u2192 skeleton \u2192 content which is worse UX\n\n**Recommended: Option A + B combined** \u2014 show per-pick spinners where values should appear, plus a subtle card-level loading indicator.\n\n**Key files:**\n- `src/components/live/LivePickCard.tsx` \u2014 lines 96-101 (game score skeletons), 126-138 (pick row skeletons)\n- `src/components/live/LivePickRow.tsx` \u2014 lines 218-220, 254-255 (per-pick Loader2 for `isAwaitingLive`)\n- `src/lib/cards/pick-display.ts` \u2014 `toLivePickData()` and `isAwaitingLive` computation\n- `src/lib/challenges/use-live-challenge.ts` \u2014 hook returning `isLoading`, `data`\n- `src/components/challenges/GroupLobbyView.tsx` \u2014 lines 635-637 (header spinner), 938 (passes `liveLoading` to ParticipantPickSection)\n- `src/components/challenges/ChallengeMatchup.tsx` \u2014 lines 432-434 (header spinner), 549/584 (passes `liveLoading` to PlayerSide)\n\n**Edge cases:**\n- Challenge is resolved (all scores final) \u2014 no loading needed\n- All picks are for scheduled games (not started) \u2014 'Scheduled' label is correct, no spinner needed\n- Mix of live and scheduled games \u2014 only live-game picks should show loading\n- Live data poll fails \u2014 should show error state, not infinite spinner\n- First poll returns immediately (fast network) \u2014 loading indicator should be brief, not jarring\n\n**Test cases:**\n- Open group challenge with active games \u2192 loading indicator visible until first live data arrives\n- Open 1v1 challenge with active games \u2192 same behavior\n- Challenge with all scheduled games \u2192 no loading spinner (correctly shows 'Scheduled')\n- Challenge with resolved games \u2192 no loading spinner (shows final scores)\n- Live data fetch fails \u2192 error state shown, not infinite spinner\n- Live data arrives quickly (<1s) \u2192 brief flash of loading is acceptable\n\n**Dev notes:**\n- The `shouldFetchLive` flag in both views correctly identifies when live data SHOULD be loading \u2014 use this to drive the loading state\n- Be careful with the `isAwaitingLive` logic \u2014 it was intentionally changed to return 'scheduled' status to avoid showing spinners on pre-game picks. The fix should only show spinners when games are actually live/in-progress\n- The Loader2 spinning icon pattern is already used in the header \u2014 reuse the same icon/style for consistency",
      "size": "S",
      "priority": "P1",
      "status": "done",
      "pr": "#126",
      "branch": "fix/live-card-loading-spinner",
      "tags": [
        "bug",
        "ux",
        "live-scoring"
      ],
      "created": "2026-03-30",
      "updated": "2026-03-30",
      "notes": [
        "User-reported: loading spinners missing on group challenges. Root cause: picks already in DB so skeleton condition (picks.length === 0) never triggers."
      ]
    },
    {
      "id": "AP-025",
      "title": "Group lobby doesn't update when another participant locks in picks",
      "description": "**Context:** In a group challenge, when a newly-invited participant accepts and locks in their picks, other participants still see them as 'Waiting for picks...' until they hard-refresh the page. The newly-invited person sees everything correctly from their own account.\n\n**Repro steps:**\n1. User A creates a group challenge with User B\n2. User A invites User C into the existing challenge (AP-009 feature)\n3. User C accepts the challenge and locks in picks\n4. User C sees all 3 players' picks and live progress correctly\n5. User A gets a notification that User C accepted\n6. User A's lobby still shows User C at the bottom as 'Waiting for picks...'\n7. Hard refresh fixes it\n\n**Root cause:** The participant roster in `GroupLobbyView` is server-rendered once and never refreshed. There is:\n- **No Supabase realtime subscription** on `challenge_participants` or `cards` tables\n- **No polling** for participant status changes (the `useLiveChallenge` hook only polls for live *scoring* data, not roster changes)\n- **No `router.refresh()` triggered by external events** \u2014 it's only called after the current user's own actions (invite, kick, etc.)\n\nWhen User C locks in, the DB is updated (`challenge_participants.card_id` is set, `status` becomes `active`), but User A's page still has the stale server-rendered data showing `participant.card === null`.\n\n**Expected behavior:** When any participant locks in picks, all other participants' lobby views should update within a few seconds to show the locked-in card.\n\n**Implementation notes:**\n\n*Option A (recommended): Add Supabase realtime subscription*\n- Subscribe to `challenge_participants` table changes filtered by `challenge_id`\n- On INSERT/UPDATE events, call `router.refresh()` to re-fetch server data\n- Pattern already exists in `src/app/challenges/page.tsx` (the challenges list page uses realtime subscriptions for challenge status changes)\n- Add subscription in `GroupLobbyView` via `useEffect` with cleanup\n\n*Option B: Piggyback on live scoring poll*\n- The `useLiveChallenge` hook already polls every 5s\n- Extend the live API response to include participant roster status\n- When a participant's status changes, trigger `router.refresh()`\n- Less ideal because it couples scoring with roster management\n\n*Option C: Add dedicated roster polling*\n- Add a lightweight poll to `/api/challenges/{id}/participants` every 10-15s\n- Compare participant statuses with current state, call `router.refresh()` on change\n- Simple but adds another polling endpoint\n\n**Key files:**\n- `src/app/challenges/[id]/page.tsx` \u2014 server component, no caching directives (lines 7-35)\n- `src/lib/challenges/queries.ts` \u2014 `getChallenge()` (lines 217-343) fetches participants + cards; `getParticipants()` (lines 799-845) queries `challenge_participants`; `linkCardToParticipant()` (lines 1271-1352) updates `card_id` on lock-in\n- `src/components/challenges/GroupLobbyView.tsx` \u2014 renders participant roster; `ParticipantPickSection` (lines 252-265) shows 'Waiting for picks...' when `participant.card === null`; calls `router.refresh()` after own actions (lines 386, 459, 504, 545, 566) but has NO realtime subscription\n- `src/lib/challenges/use-live-challenge.ts` \u2014 polls for live scoring only, not roster changes\n- `src/app/api/cards/route.ts` \u2014 POST handler calls `linkCardToParticipant()` (line 361-363) for group challenges\n\n**Edge cases:**\n- Multiple participants lock in simultaneously \u2014 should handle rapid successive updates\n- Participant declines after accepting \u2014 roster should update too\n- User navigates away and back \u2014 should see fresh data (currently works via server render)\n- Realtime subscription disconnects \u2014 should reconnect or fall back to polling\n\n**Test cases:**\n- User A is on lobby, User B locks in \u2192 User A sees User B's card within 5s\n- User A is on lobby, User C is invited and accepts \u2192 User A sees User C appear in roster\n- User A is on lobby, User B declines \u2192 User A sees User B status change\n- Realtime subscription reconnects after network blip\n- Multiple participants lock in in quick succession \u2192 all updates reflected\n\n**Dev notes:**\n- The challenges list page (`src/app/challenges/page.tsx`) already uses Supabase realtime \u2014 follow that pattern\n- `router.refresh()` re-runs the server component without a full page reload, preserving client state \u2014 this is the right approach\n- Don't subscribe to `cards` table (too noisy) \u2014 subscribe to `challenge_participants` filtered by `challenge_id` for targeted updates\n- Also affects 1v1 `ChallengeMatchup` if the opponent locks in while the challenger is viewing the page, though less common since 1v1 usually has sequential lock-in",
      "size": "M",
      "priority": "P1",
      "status": "done",
      "pr": "#125",
      "branch": "fix/lobby-realtime-refresh",
      "tags": [
        "bug",
        "group-challenge",
        "realtime"
      ],
      "created": "2026-03-30",
      "updated": "2026-03-30",
      "notes": [
        "User-reported. Also affects ChallengeMatchup (1v1) in theory. The challenges LIST page already has realtime subscriptions \u2014 follow the same pattern."
      ]
    }
  ]
};

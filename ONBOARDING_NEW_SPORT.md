# Onboarding a New Sport

Step-by-step guide for adding a new sport to Sports Tower. Uses "NFL" as an example throughout.

---

## Overview

Adding a sport touches **3 layers**: the Odds API pipeline (props), the stats service (live scoring + game logs), and the frontend (UI/filters). The Odds API pipeline is mostly plug-and-play. Live scoring requires a new data source.

| Layer | Effort | Plug-and-play? |
|-------|--------|----------------|
| Props pipeline (Odds API → DB → UI) | ~30 min | Yes |
| Team logos & tricodes | ~15 min | Yes |
| Category filters & sorting | ~10 min | Yes |
| Player ID enrichment (headshots) | ~1 hr | Partially — needs a player roster source |
| Live scoring & boxscores | ~3-4 hrs | No — needs new stats-service endpoints |
| Player game logs | ~2 hrs | No — needs new data source |

---

## Step 1: Props Pipeline (Required)

This is the minimum to get prop lines showing on the `/props` page.

### 1a. Add the Sport Key

**`src/lib/odds-api/constants.ts`**
- Add to `SportKey` union type: `export type SportKey = "nba" | "ncaab" | "epl" | "nhl" | "nfl";`
- Add entry to `SPORT_CONFIGS`:
  ```ts
  nfl: {
    oddsApiKey: "americanfootball_nfl",  // from Odds API docs
    markets: ["player_pass_yds", "player_rush_yds", ...],
    marketToCategory: {
      player_pass_yds: "pass_yards",
      player_rush_yds: "rush_yards",
      // ...
    },
  },
  ```

### 1b. Add Stat Categories

**`src/lib/supabase/types.ts`**
- Add new categories to `StatCategory` union type (e.g., `| "pass_yards" | "rush_yards"`)

### 1c. Frontend Constants

**`src/lib/constants.ts`**
- Add to `Sport` type and `SPORTS` record with display name + emoji icon
- Add to `isValidSport()` check
- Add to `SPORT_LABELS` record
- Add entries to `CATEGORY_LABELS` (e.g., `pass_yards: "Pass Yds"`)
- Add entries to `CATEGORY_COLORS` (e.g., `pass_yards: "bg-blue-500/20 text-blue-400"`)

### 1d. Props Page

**`src/app/props/page.tsx`**
- Add to `SPORT_PRIORITY` array (controls default sport when no URL param)
- Add to `rawSport ===` validation check
- Add emoji to `emptyEmoji` ternary

### 1e. UI Components

**`src/components/props/SportSelector.tsx`**
- Add to `SPORTS` array: `{ value: "nfl", label: "NFL" }`

**`src/components/props/CategoryFilter.tsx`**
- Add a `NFL_CATEGORIES` array with the relevant `CategoryOption` entries
- Add case to `getCategoriesForSport()`

**`src/components/props/GameCard.tsx`**
- Add entries to `STAT_SORT_ORDER` record (controls stat ordering within a game card)

### 1f. Sync Route

**`src/app/api/props/sync/route.ts`**
- Update the `multiResults.size < N` check to include the new sport count
- Add sport to the `missing` array filter

### 1g. Multi-Sport Fetch

**`src/lib/odds-api/client.ts`**
- Add `"nfl"` to the `sports` array in `fetchAllPropsMultiSport()`

**That's it for props.** After these changes, triggering a sync (`POST /api/props/sync?force=true`) will pull NFL props from the Odds API into the database, and they'll appear on the `/props` page.

---

## Step 2: Team Logos & Tricodes (Recommended)

Without this, teams show a 3-letter abbreviation fallback instead of logos.

**`src/lib/constants.ts`**
- Add entries to `TEAM_TRICODES` mapping full team names to abbreviations (e.g., `"Kansas City Chiefs": "KC"`)
- Add a team ID map or set for logo URL resolution (pattern depends on logo CDN):
  - NBA: `TEAM_NBA_IDS` → `cdn.nba.com` logo URL
  - EPL: `EPL_TEAM_IDS` → `api-sports.io` logo URL
  - NHL: `NHL_TEAM_TRICODES` → `espncdn.com` logo URL
- Update `teamLogoUrl()` function with the new sport's logo URL pattern

---

## Step 3: Player ID Enrichment (Recommended)

Without this, player headshots show initials instead of photos. Requires a roster/player-list API for the sport.

**`src/lib/odds-api/cache.ts`** — `cacheProps()` function
- Add a sport-specific block (like the existing `if (sport === "nba")` and `if (sport === "ncaab")` blocks)
- Fetch player roster data and populate `playerIdMap`, `playerTeamMap`, `playerPositionMap`

**`src/lib/constants.ts`** — `getPlayerHeadshotUrl()` function
- Add a URL pattern for the new sport's headshot CDN
- NBA uses `cdn.nba.com/headshots`
- NCAAB uses `a.espncdn.com/combiner/i?img=/i/headshots/...`

**`src/app/api/props/backfill/route.ts`**
- Add enrichment logic for the new sport (same pattern as NBA/NCAAB blocks)

---

## Step 4: Live Scoring (Optional — enables real-time pick tracking)

This is the most work. Without it, picks still resolve via the resolution cron job, but users won't see live score updates on the "My Picks" page.

### 4a. Python Stats Service

**New file: `services/stats-service/endpoints/{sport}.py`**
- `GET /{sport}/games/today` — Today's games with scores
- `GET /{sport}/games/today/live` — Same but cached (30s TTL)
- `GET /{sport}/games/{id}/boxscore` — Individual player stats for a game
- `GET /{sport}/games/{id}/boxscore/live` — Same but cached (30s TTL)

**New file: `services/stats-service/utils/{sport}_client.py`**
- Data fetching + parsing from the sport's data source (ESPN API, nba_api, api-sports.io, etc.)

**`services/stats-service/main.py`**
- Register the new router: `app.include_router({sport}_router)`

### 4b. TypeScript Stats Client

**`src/lib/stats-service/client.ts`**
- Add fetch functions: `fetch{Sport}Games()`, `fetch{Sport}GamesLive()`, `fetch{Sport}Boxscore()`, `fetch{Sport}BoxscoreLive()`
- Ensure `PlayerBoxScore` interface includes any new stat fields

### 4c. Live Computation

**`src/lib/cards/live-computation.ts`**
- Add entry to `SPORT_FETCHERS` record with the new fetch functions

### 4d. Card Resolution

**`src/lib/cards/resolution.ts`**
- Update `resolveCard()` to handle the new sport's boxscore fetcher
- Update `extractStatValue()` if the sport has stat fields not already in `PlayerBoxScore`

### 4e. Game Status Sync

**`src/app/api/games/sync-status/route.ts`**
- Add a sync block for the new sport (fetches game statuses and updates the `games` table)
- Includes team name matching logic (Odds API names ↔ data source names)

---

## Step 5: Player Game Logs (Optional — enables player profile sheet)

### 5a. Python Stats Service

**`services/stats-service/endpoints/gamelog.py`**
- Add a handler for the new sport in the gamelog endpoint
- Needs a data source that provides per-game player stats

### 5b. Gamelog API Route

**`src/app/api/players/[playerId]/gamelog/route.ts`**
- Add sport to `VALID_SPORTS` array

### 5c. Stat Mapping

**`src/lib/players/stat-mapping.ts`**
- Add entries to `CATEGORY_FIELDS` mapping if the sport has categories that map to existing `GameLogEntry` fields
- Extend `GameLogField` type if the sport needs new fields

---

## Checklist

```
Props pipeline:
  [ ] SportKey type + SPORT_CONFIGS
  [ ] StatCategory types
  [ ] Frontend constants (Sport, SPORTS, labels, colors)
  [ ] Props page (priority, validation, emoji)
  [ ] SportSelector component
  [ ] CategoryFilter component
  [ ] GameCard STAT_SORT_ORDER
  [ ] Sync route sport count
  [ ] Multi-sport fetch array

Team identity:
  [ ] TEAM_TRICODES mapping
  [ ] Team logo URL mapping + teamLogoUrl()

Player enrichment:
  [ ] cacheProps() player lookup
  [ ] getPlayerHeadshotUrl()
  [ ] Backfill route

Live scoring:
  [ ] Python stats-service endpoints
  [ ] Python data client
  [ ] TypeScript stats client functions
  [ ] SPORT_FETCHERS in live-computation.ts
  [ ] resolveCard() + extractStatValue()
  [ ] Game status sync route

Player game logs:
  [ ] Python gamelog endpoint handler
  [ ] VALID_SPORTS in gamelog API route
  [ ] Stat mapping entries
```

---

## Verification

1. `npx tsc --noEmit` — must pass
2. `POST /api/props/sync?force=true` — should show new sport in `sports` array
3. Visit `/props?sport={sport}` — should show games and prop lines
4. Click a player (if enrichment done) — should show headshot + game log
5. Lock a card with picks → wait for resolution — picks should resolve correctly

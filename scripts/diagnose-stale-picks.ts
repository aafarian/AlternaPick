/**
 * Diagnostic script: finds resolved picks with null actual_value,
 * fetches the boxscore from the stats service, and reports why matching failed.
 *
 * Usage: npx tsx scripts/diagnose-stale-picks.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const STATS_SERVICE_URL = process.env.STATS_SERVICE_URL || "http://localhost:8000";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function normForMatch(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function main() {
  console.log("=== Diagnosing Stale Picks (null actual_value on resolved cards) ===\n");

  // 1. Find resolved picks with null actual_value
  const { data: stalePicks, error } = await supabase
    .from("picks")
    .select(
      "id, card_id, selection, result, actual_value, props(player_name, player_id, stat_category, line, game_id, games(external_event_id, sport, status, home_team, away_team))"
    )
    .is("actual_value", null)
    .in("result", ["hit", "miss"])
    .limit(50);

  if (error) {
    console.error("DB query error:", error.message);
    return;
  }

  if (!stalePicks || stalePicks.length === 0) {
    console.log("No stale picks found (all resolved picks have actual_value).");
    return;
  }

  console.log(`Found ${stalePicks.length} stale pick(s):\n`);

  // Group by game
  const gameMap = new Map<string, typeof stalePicks>();
  for (const pick of stalePicks) {
    const props = pick.props as any;
    const gameId = props?.games?.external_event_id ?? "NO_GAME_ID";
    if (!gameMap.has(gameId)) gameMap.set(gameId, []);
    gameMap.get(gameId)!.push(pick);
  }

  for (const [gameId, picks] of gameMap) {
    const props = (picks[0].props as any);
    const sport = props?.games?.sport ?? "unknown";
    const home = props?.games?.home_team ?? "?";
    const away = props?.games?.away_team ?? "?";
    const dbStatus = props?.games?.status ?? "?";

    console.log(`--- Game: ${away} @ ${home} (sport=${sport}, external_event_id=${gameId}, db_status=${dbStatus}) ---`);

    if (gameId === "NO_GAME_ID") {
      console.log("  !! No ESPN event ID set on this game — cannot fetch boxscore\n");
      for (const p of picks) {
        const pp = p.props as any;
        console.log(`  Pick: ${pp?.player_name} | ${pp?.stat_category} ${p.selection} ${pp?.line} → result=${p.result}, actual_value=${p.actual_value}`);
      }
      console.log();
      continue;
    }

    // 2. Fetch boxscore from stats service
    let boxscore: any[] = [];
    const endpoint = sport === "ncaab"
      ? `${STATS_SERVICE_URL}/ncaab/games/${gameId}/boxscore`
      : sport === "epl"
        ? `${STATS_SERVICE_URL}/soccer/games/${gameId}/boxscore`
        : `${STATS_SERVICE_URL}/games/${gameId}/boxscore`;

    try {
      const res = await fetch(endpoint, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        console.log(`  !! Boxscore fetch failed: HTTP ${res.status}`);
      } else {
        const json = await res.json();
        boxscore = json.data ?? [];
        console.log(`  Boxscore: ${boxscore.length} player(s) returned`);
      }
    } catch (err: any) {
      console.log(`  !! Boxscore fetch error: ${err.message}`);
    }

    // 3. For each stale pick, try to match
    for (const p of picks) {
      const pp = p.props as any;
      const playerName = pp?.player_name ?? "?";
      const normalized = normForMatch(playerName);

      console.log(`\n  Pick: "${playerName}" (normalized: "${normalized}") | ${pp?.stat_category} ${p.selection} ${pp?.line} → result=${p.result}`);

      if (boxscore.length === 0) {
        console.log("    !! No boxscore data to match against");
        continue;
      }

      // Try exact match
      const exactMatch = boxscore.find(
        (b: any) => normForMatch(b.player_name) === normalized
      );
      if (exactMatch) {
        console.log(`    EXACT MATCH: "${exactMatch.player_name}" (id=${exactMatch.player_id})`);
        console.log(`    Stats: pts=${exactMatch.points}, reb=${exactMatch.rebounds}, ast=${exactMatch.assists}, 3pm=${exactMatch.threes_made}, blk=${exactMatch.blocks}, stl=${exactMatch.steals}, to=${exactMatch.turnovers}`);
        continue;
      }

      // Try last name
      const lastName = normalized.split(" ").pop() ?? "";
      const lastNameMatches = boxscore.filter((b: any) =>
        normForMatch(b.player_name).includes(lastName)
      );
      if (lastNameMatches.length === 1) {
        console.log(`    LAST NAME MATCH: "${lastNameMatches[0].player_name}" (id=${lastNameMatches[0].player_id})`);
        console.log(`    Stats: pts=${lastNameMatches[0].points}, reb=${lastNameMatches[0].rebounds}, ast=${lastNameMatches[0].assists}`);
        continue;
      }
      if (lastNameMatches.length > 1) {
        console.log(`    AMBIGUOUS last name "${lastName}" matched ${lastNameMatches.length} players:`);
        for (const m of lastNameMatches) {
          console.log(`      - "${m.player_name}"`);
        }
        continue;
      }

      // Try partial
      const partial = boxscore.find((b: any) => {
        const norm = normForMatch(b.player_name);
        return norm.includes(normalized) || normalized.includes(norm);
      });
      if (partial) {
        console.log(`    PARTIAL MATCH: "${partial.player_name}" (id=${partial.player_id})`);
        console.log(`    Stats: pts=${partial.points}, reb=${partial.rebounds}, ast=${partial.assists}`);
        continue;
      }

      // No match — list all players for debugging
      console.log(`    !! NO MATCH FOUND. Boxscore players for this game:`);
      for (const b of boxscore.slice(0, 30)) {
        console.log(`      - "${b.player_name}" (team=${b.team_tricode})`);
      }
      if (boxscore.length > 30) {
        console.log(`      ... and ${boxscore.length - 30} more`);
      }
    }

    console.log();
  }
}

main().catch(console.error);

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPlayers, fetchNcaabPlayers, fetchNcaabTeams } from "@/lib/stats-service/client";
import { unauthorized, handleApiError } from "@/lib/api/errors";

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/'/g, "'")
    .replace(/-/g, " ")
    .replace(/\s+(jr|sr|iii|ii|iv|v)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function lookupPlayer(name: string, map: Map<string, string>): string | null {
  const lower = name.toLowerCase();
  const normalized = normalizeName(name);
  const exact = map.get(lower) ?? map.get(normalized);
  if (exact) return exact;

  // Fuzzy: last name + first initial
  const parts = normalized.split(/\s+/);
  if (parts.length < 2) return null;
  const lastName = parts[parts.length - 1];
  const firstInitial = parts[0][0];
  for (const [key, val] of map) {
    const keyParts = key.split(/\s+/);
    if (keyParts.length < 2) continue;
    if (keyParts[keyParts.length - 1] === lastName && keyParts[0][0] === firstInitial) {
      return val;
    }
  }

  // Last resort: match by last name only (both ways — handles
  // compound last names like "gilgeous alexander" vs "gilgeous-alexander")
  for (const [key, val] of map) {
    const keyNorm = normalizeName(key);
    if (keyNorm.endsWith(lastName) && keyNorm[0] === firstInitial) {
      return val;
    }
    // Also try if the prop name's last word is contained in the key's last words
    const keyParts2 = keyNorm.split(/\s+/);
    if (keyParts2.length >= 2) {
      const keyLast = keyParts2[keyParts2.length - 1];
      if (keyLast === lastName && keyParts2[0][0] === firstInitial) {
        return val;
      }
    }
  }
  return null;
}

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bst\.\s*/g, "saint ")
    .replace(/\bmt\.\s*/g, "mount ")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * POST /api/props/backfill
 *
 * Re-enriches all props that have null player_id by looking up player names
 * against the stats service. Fixes data clobbered by syncs that ran before
 * the null-guard was added.
 */
export async function POST(request: NextRequest) {
  const syncSecret = process.env.SYNC_SECRET;
  if (syncSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${syncSecret}`) {
      return unauthorized();
    }
  }

  try {
    const supabase = createAdminClient();

    // Fetch all props missing player_id, joined with game sport + teams
    const { data: nullProps, error: fetchError } = await supabase
      .from("props")
      .select("id, player_name, game_id, games(sport, home_team, away_team)")
      .is("player_id", null);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const props = (nullProps ?? []) as {
      id: string;
      player_name: string;
      game_id: string;
      games: { sport: string; home_team: string; away_team: string } | null;
    }[];

    if (props.length === 0) {
      return NextResponse.json({ updated: 0, message: "No props with null player_id" });
    }

    // Group props by sport
    const nbaProps = props.filter((p) => p.games?.sport === "nba");
    const ncaabProps = props.filter((p) => p.games?.sport === "ncaab");

    let nbaUpdated = 0;
    let ncaabUpdated = 0;
    const unmatchedNba: string[] = [];
    const unmatchedNcaab: string[] = [];
    let nbaPlayerMapSize = 0;
    let ncaabPlayerMapSize = 0;

    // --- NBA enrichment ---
    if (nbaProps.length > 0) {
      try {
        const allPlayers = await fetchAllPlayers();
        const playerMap = new Map<string, string>();
        for (const p of allPlayers) {
          playerMap.set(p.full_name.toLowerCase(), p.id);
          playerMap.set(normalizeName(p.full_name), p.id);
        }
        nbaPlayerMapSize = allPlayers.length;

        for (const prop of nbaProps) {
          const playerId = lookupPlayer(prop.player_name, playerMap);
          if (playerId) {
            const { error } = await (supabase.from("props") as any)
              .update({ player_id: playerId })
              .eq("id", prop.id);
            if (!error) nbaUpdated++;
          } else {
            unmatchedNba.push(prop.player_name);
          }
        }
      } catch (err) {
        console.error("[Backfill] NBA enrichment failed:", err);
        unmatchedNba.push(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // --- NCAAB enrichment ---
    if (ncaabProps.length > 0) {
      try {
        // Collect unique team names from the null props' games
        const propTeamNames = new Set<string>();
        for (const p of ncaabProps) {
          if (p.games?.home_team) propTeamNames.add(p.games.home_team);
          if (p.games?.away_team) propTeamNames.add(p.games.away_team);
        }

        // Map team names → ESPN team IDs
        const allTeams = await fetchNcaabTeams();
        const normalizedEspn = new Map<string, string>();
        for (const [name, id] of Object.entries(allTeams)) {
          normalizedEspn.set(normalizeTeamName(name), id);
        }

        // Match team names to ESPN IDs, preserving original team name
        const matchedTeams: Array<[string, string]> = []; // [teamName, teamId]
        for (const teamName of propTeamNames) {
          const exactId = allTeams[teamName];
          if (exactId) { matchedTeams.push([teamName, exactId]); continue; }

          const normName = normalizeTeamName(teamName);
          const normId = normalizedEspn.get(normName);
          if (normId) { matchedTeams.push([teamName, normId]); continue; }

          // Partial match
          for (const [espnNorm, id] of normalizedEspn) {
            if (espnNorm.includes(normName) || normName.includes(espnNorm)) {
              matchedTeams.push([teamName, id]);
              break;
            }
          }
        }

        // Fetch rosters per-team to build both playerMap and playerTeamMap
        const playerMap = new Map<string, string>();
        const ncaabTeamMap = new Map<string, string>();
        for (const [teamName, teamId] of matchedTeams) {
          try {
            const roster = await fetchNcaabPlayers([teamId]);
            for (const [name, id] of Object.entries(roster)) {
              playerMap.set(name, id);
              playerMap.set(normalizeName(name), id);
              ncaabTeamMap.set(name.toLowerCase(), teamName);
              ncaabTeamMap.set(normalizeName(name), teamName);
            }
          } catch (err) {
            console.error(`[Backfill] NCAAB roster fetch failed for "${teamName}" (${teamId}):`, err);
          }
        }
        ncaabPlayerMapSize = playerMap.size / 2; // each player has 2 entries

        for (const prop of ncaabProps) {
          const playerId = lookupPlayer(prop.player_name, playerMap);
          const playerTeam = lookupPlayer(prop.player_name, ncaabTeamMap);
          if (playerId || playerTeam) {
            const updatePayload: Record<string, unknown> = {};
            if (playerId) updatePayload.player_id = playerId;
            if (playerTeam) updatePayload.player_team = playerTeam;

            const { error } = await (supabase.from("props") as any)
              .update(updatePayload)
              .eq("id", prop.id);
            if (!error) ncaabUpdated++;
          } else {
            unmatchedNcaab.push(prop.player_name);
          }
        }
      } catch (err) {
        console.error("[Backfill] NCAAB enrichment failed:", err);
        unmatchedNcaab.push(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // --- Second pass: NCAAB props with player_id but missing player_team ---
    const { data: teamNullProps } = await supabase
      .from("props")
      .select("id, player_name, game_id, games(sport, home_team, away_team)")
      .not("player_id", "is", null)
      .is("player_team", null);

    const ncaabTeamNullProps = ((teamNullProps ?? []) as typeof props).filter(
      (p) => p.games?.sport === "ncaab"
    );

    let ncaabTeamBackfilled = 0;
    if (ncaabTeamNullProps.length > 0) {
      try {
        const teamNames = new Set<string>();
        for (const p of ncaabTeamNullProps) {
          if (p.games?.home_team) teamNames.add(p.games.home_team);
          if (p.games?.away_team) teamNames.add(p.games.away_team);
        }

        const allTeams = await fetchNcaabTeams();
        const normalizedEspn2 = new Map<string, string>();
        for (const [name, id] of Object.entries(allTeams)) {
          normalizedEspn2.set(normalizeTeamName(name), id);
        }

        const ncaabTeamMap2 = new Map<string, string>();
        for (const teamName of teamNames) {
          const normName = normalizeTeamName(teamName);
          const teamId = allTeams[teamName] ?? normalizedEspn2.get(normName);
          if (!teamId) {
            for (const [espnNorm, id] of normalizedEspn2) {
              if (espnNorm.includes(normName) || normName.includes(espnNorm)) {
                try {
                  const roster = await fetchNcaabPlayers([id]);
                  for (const [name] of Object.entries(roster)) {
                    ncaabTeamMap2.set(name.toLowerCase(), teamName);
                    ncaabTeamMap2.set(normalizeName(name), teamName);
                  }
                } catch { /* skip */ }
                break;
              }
            }
            continue;
          }
          try {
            const roster = await fetchNcaabPlayers([teamId]);
            for (const [name] of Object.entries(roster)) {
              ncaabTeamMap2.set(name.toLowerCase(), teamName);
              ncaabTeamMap2.set(normalizeName(name), teamName);
            }
          } catch { /* skip */ }
        }

        for (const prop of ncaabTeamNullProps) {
          const playerTeam = lookupPlayer(prop.player_name, ncaabTeamMap2);
          if (playerTeam) {
            const { error } = await (supabase.from("props") as any)
              .update({ player_team: playerTeam })
              .eq("id", prop.id);
            if (!error) ncaabTeamBackfilled++;
          }
        }
      } catch (err) {
        console.error("[Backfill] NCAAB team backfill failed:", err);
      }
    }

    return NextResponse.json({
      total_null: props.length,
      nba_null: nbaProps.length,
      ncaab_null: ncaabProps.length,
      nba_updated: nbaUpdated,
      ncaab_updated: ncaabUpdated,
      updated: nbaUpdated + ncaabUpdated,
      ncaab_team_backfilled: ncaabTeamBackfilled,
      nba_player_map_size: nbaPlayerMapSize,
      ncaab_player_map_size: ncaabPlayerMapSize,
      unmatched_nba: unmatchedNba.slice(0, 30),
      unmatched_ncaab: unmatchedNcaab.slice(0, 30),
    });
  } catch (error) {
    return handleApiError(error, "Failed to backfill player IDs");
  }
}

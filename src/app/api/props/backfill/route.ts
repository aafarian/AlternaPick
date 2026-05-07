import { type NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllPlayers, fetchNcaabPlayers, fetchNcaabTeams, fetchSoccerPlayers, fetchMlbPlayers } from "@/lib/stats-service/client";
import { unauthorized, handleApiError } from "@/lib/api/errors";
import { requireAdmin } from "@/lib/auth/admin";
import { logError } from "@/lib/logger";

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

  const parts = normalized.split(/\s+/);
  if (parts.length < 2) return null;
  const lastName = parts[parts.length - 1];
  const firstInitial = parts[0][0];

  // Fuzzy: last name + first initial
  for (const [key, val] of map) {
    const keyParts = key.split(/\s+/);
    if (keyParts.length < 2) continue;
    if (keyParts[keyParts.length - 1] === lastName && keyParts[0][0] === firstInitial) {
      return val;
    }
  }

  // For 3+ word names, try dropping the last word (handles second surnames:
  // "Abel Ruiz Ortega" → try "abel ruiz" against map)
  if (parts.length >= 3) {
    const shortened = parts.slice(0, -1).join(" ");
    const match = map.get(shortened);
    if (match) return match;
  }

  // Prefix matching: check if a map key is a prefix of the name or vice versa.
  // Handles "Abel Ruiz" (api-sports) matching "Abel Ruiz Ortega" (odds API).
  // Requires at least 2 words and same first initial to avoid false positives.
  for (const [key, val] of map) {
    const keyNorm = normalizeName(key);
    const keyParts = keyNorm.split(/\s+/);
    if (keyParts.length < 2 || keyParts[0][0] !== firstInitial) continue;
    if (normalized.startsWith(keyNorm + " ") || keyNorm.startsWith(normalized + " ")) {
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
  // Accept either SYNC_SECRET (cron) or admin session (dashboard)
  const syncSecret = process.env.SYNC_SECRET;
  const authHeader = request.headers.get("authorization");
  const hasSyncAuth = syncSecret && authHeader === `Bearer ${syncSecret}`;

  if (!hasSyncAuth) {
    const admin = await requireAdmin();
    if (!admin.isAdmin) return admin.response;
  }

  try {
    const supabase = createAdminClient();

    // Fetch null-player_id props per sport to avoid Supabase row limits.
    type PropRow = {
      id: string;
      player_name: string;
      game_id: string;
      games: { sport: string; home_team: string; away_team: string } | null;
    };

    async function fetchNullProps(sport: string | string[]): Promise<PropRow[]> {
      const sports = Array.isArray(sport) ? sport : [sport];
      const allProps: PropRow[] = [];
      for (const s of sports) {
        const { data } = await (supabase.from("props") as any)
          .select("id, player_name, game_id, games!inner(sport, home_team, away_team)")
          .is("player_id", null)
          .eq("games.sport", s)
          .limit(5000);
        if (data) allProps.push(...(data as PropRow[]));
      }
      return allProps;
    }

    const [nbaProps, ncaabProps, soccerProps, mlbProps] = await Promise.all([
      fetchNullProps("nba"),
      fetchNullProps("ncaab"),
      fetchNullProps(["epl", "la_liga"]),
      fetchNullProps("mlb"),
    ]);

    const totalNull = nbaProps.length + ncaabProps.length + soccerProps.length + mlbProps.length;

    if (totalNull === 0) {
      return NextResponse.json({ updated: 0, message: "No props with null player_id" });
    }

    let nbaUpdated = 0;
    let ncaabUpdated = 0;
    let soccerUpdated = 0;
    let mlbUpdated = 0;
    const unmatchedNba: string[] = [];
    const unmatchedNcaab: string[] = [];
    const unmatchedSoccer: string[] = [];
    const unmatchedMlb: string[] = [];
    let nbaPlayerMapSize = 0;
    let ncaabPlayerMapSize = 0;
    let soccerPlayerMapSize = 0;
    let mlbPlayerMapSize = 0;

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
        logError("backfill", "NBA enrichment failed", undefined, err);
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
            logError("backfill", `NCAAB roster fetch failed for "${teamName}" (${teamId})`, undefined, err);
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
        logError("backfill", "NCAAB enrichment failed", undefined, err);
        unmatchedNcaab.push(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // --- Soccer (EPL / La Liga) enrichment ---
    if (soccerProps.length > 0) {
      // Group by league since fetchSoccerPlayers needs the league param
      const byLeague = new Map<string, typeof nbaProps>();
      for (const p of soccerProps) {
        const sport = p.games!.sport;
        if (!byLeague.has(sport)) byLeague.set(sport, []);
        byLeague.get(sport)!.push(p);
      }

      for (const [league, leagueProps] of byLeague) {
        try {
          const teamNames = new Set<string>();
          for (const p of leagueProps) {
            if (p.games?.home_team) teamNames.add(p.games.home_team);
            if (p.games?.away_team) teamNames.add(p.games.away_team);
          }

          const soccerPlayerMap = await fetchSoccerPlayers(
            Array.from(teamNames),
            league
          );
          const playerMap = new Map<string, string>();
          for (const [name, id] of Object.entries(soccerPlayerMap)) {
            playerMap.set(name.toLowerCase(), id);
            playerMap.set(normalizeName(name), id);
          }
          soccerPlayerMapSize += Object.keys(soccerPlayerMap).length;

          for (const prop of leagueProps) {
            const playerId = lookupPlayer(prop.player_name, playerMap);
            if (playerId) {
              const { error } = await (supabase.from("props") as any)
                .update({ player_id: playerId })
                .eq("id", prop.id);
              if (!error) soccerUpdated++;
            } else {
              unmatchedSoccer.push(prop.player_name);
            }
          }
        } catch (err) {
          logError("backfill", `${league} enrichment failed`, undefined, err);
          unmatchedSoccer.push(`ERROR (${league}): ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    // --- MLB enrichment ---
    if (mlbProps.length > 0) {
      try {
        // Collect unique team names from MLB props
        const mlbTeamNames = new Set<string>();
        for (const p of mlbProps) {
          if (p.games?.home_team) mlbTeamNames.add(p.games.home_team);
          if (p.games?.away_team) mlbTeamNames.add(p.games.away_team);
        }

        // Fetch per-team rosters to build both player ID and team maps
        const playerIdMap = new Map<string, string>();
        const mlbTeamMap = new Map<string, string>();

        // Get ESPN team IDs from today's MLB games
        const { fetchMlbGames } = await import("@/lib/stats-service/client");
        const mlbGames = await fetchMlbGames();
        const teamIdMap = new Map<string, string>(); // teamName → espnTeamId
        for (const g of mlbGames) {
          if (g.home_team_id) teamIdMap.set(g.home_team, g.home_team_id);
          if (g.away_team_id) teamIdMap.set(g.away_team, g.away_team_id);
        }

        for (const teamName of mlbTeamNames) {
          const teamId = teamIdMap.get(teamName);
          if (!teamId) continue;
          try {
            const roster = await fetchMlbPlayers([teamId]);
            for (const [name, id] of Object.entries(roster)) {
              playerIdMap.set(name.toLowerCase(), id);
              playerIdMap.set(normalizeName(name), id);
              mlbTeamMap.set(name.toLowerCase(), teamName);
              mlbTeamMap.set(normalizeName(name), teamName);
            }
          } catch {
            // Individual team roster failure is non-blocking
          }
        }
        mlbPlayerMapSize = playerIdMap.size / 2;

        for (const prop of mlbProps) {
          const playerId = lookupPlayer(prop.player_name, playerIdMap);
          const playerTeam = lookupPlayer(prop.player_name, mlbTeamMap);
          if (playerId || playerTeam) {
            const updatePayload: Record<string, unknown> = {};
            if (playerId) updatePayload.player_id = playerId;
            if (playerTeam) updatePayload.player_team = playerTeam;
            const { error } = await (supabase.from("props") as any)
              .update(updatePayload)
              .eq("id", prop.id);
            if (!error) mlbUpdated++;
          } else {
            unmatchedMlb.push(prop.player_name);
          }
        }
      } catch (err) {
        logError("backfill", "MLB enrichment failed", undefined, err);
        unmatchedMlb.push(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // --- Second pass: props with player_id but missing player_team ---
    // Fetch per-sport to avoid row limit
    const [ncaabTeamNullResult, mlbTeamNullResult] = await Promise.all([
      (supabase.from("props") as any)
        .select("id, player_name, game_id, games!inner(sport, home_team, away_team)")
        .not("player_id", "is", null)
        .is("player_team", null)
        .eq("games.sport", "ncaab")
        .limit(5000),
      (supabase.from("props") as any)
        .select("id, player_name, game_id, games!inner(sport, home_team, away_team)")
        .not("player_id", "is", null)
        .is("player_team", null)
        .eq("games.sport", "mlb")
        .limit(5000),
    ]);

    const ncaabTeamNullProps = (ncaabTeamNullResult.data ?? []) as typeof nbaProps;
    const mlbTeamNullProps = (mlbTeamNullResult.data ?? []) as typeof nbaProps;

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
                } catch (err) {
                  logError("backfill", `Failed to fetch NCAAB roster for team ${teamName}`, undefined, err);
                }
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
          } catch (err) {
            logError("backfill", `Failed to fetch NCAAB roster for team ${teamName}`, undefined, err);
          }
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
        logError("backfill", "NCAAB team backfill failed", undefined, err);
      }
    }

    // --- MLB team backfill (player_id set but player_team null) ---
    let mlbTeamBackfilled = 0;
    if (mlbTeamNullProps.length > 0) {
      try {
        const { fetchMlbGames: fetchMlbGames2 } = await import("@/lib/stats-service/client");
        const mlbGames2 = await fetchMlbGames2();
        const teamIdMap2 = new Map<string, string>();
        for (const g of mlbGames2) {
          if (g.home_team_id) teamIdMap2.set(g.home_team, g.home_team_id);
          if (g.away_team_id) teamIdMap2.set(g.away_team, g.away_team_id);
        }

        const mlbTeamNames2 = new Set<string>();
        for (const p of mlbTeamNullProps) {
          if (p.games?.home_team) mlbTeamNames2.add(p.games.home_team);
          if (p.games?.away_team) mlbTeamNames2.add(p.games.away_team);
        }

        const mlbTeamMap2 = new Map<string, string>();
        for (const teamName of mlbTeamNames2) {
          const teamId = teamIdMap2.get(teamName);
          if (!teamId) continue;
          try {
            const roster = await fetchMlbPlayers([teamId]);
            for (const [name] of Object.entries(roster)) {
              mlbTeamMap2.set(name.toLowerCase(), teamName);
              mlbTeamMap2.set(normalizeName(name), teamName);
            }
          } catch {
            // Non-blocking
          }
        }

        for (const prop of mlbTeamNullProps) {
          const playerTeam = lookupPlayer(prop.player_name, mlbTeamMap2);
          if (playerTeam) {
            const { error } = await (supabase.from("props") as any)
              .update({ player_team: playerTeam })
              .eq("id", prop.id);
            if (!error) mlbTeamBackfilled++;
          }
        }
      } catch (err) {
        logError("backfill", "MLB team backfill failed", undefined, err);
      }
    }

    return NextResponse.json({
      total_null: totalNull,
      nba_null: nbaProps.length,
      ncaab_null: ncaabProps.length,
      soccer_null: soccerProps.length,
      mlb_null: mlbProps.length,
      nba_updated: nbaUpdated,
      ncaab_updated: ncaabUpdated,
      soccer_updated: soccerUpdated,
      mlb_updated: mlbUpdated,
      updated: nbaUpdated + ncaabUpdated + soccerUpdated + mlbUpdated,
      ncaab_team_backfilled: ncaabTeamBackfilled,
      mlb_team_backfilled: mlbTeamBackfilled,
      nba_player_map_size: nbaPlayerMapSize,
      ncaab_player_map_size: ncaabPlayerMapSize,
      soccer_player_map_size: soccerPlayerMapSize,
      mlb_player_map_size: mlbPlayerMapSize,
      unmatched_nba: unmatchedNba.slice(0, 30),
      unmatched_ncaab: unmatchedNcaab.slice(0, 30),
      unmatched_soccer: unmatchedSoccer.slice(0, 30),
      unmatched_mlb: unmatchedMlb.slice(0, 30),
    });
  } catch (error) {
    return handleApiError(error, "Failed to backfill player IDs");
  }
}

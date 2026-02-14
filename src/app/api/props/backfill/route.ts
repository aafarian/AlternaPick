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
    .replace(/\s+(jr|sr|iii|ii|iv)$/i, "")
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
  return null;
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

    // Fetch all props missing player_id, joined with game sport
    const { data: nullProps, error: fetchError } = await supabase
      .from("props")
      .select("id, player_name, game_id, games(sport)")
      .is("player_id", null);

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const props = (nullProps ?? []) as {
      id: string;
      player_name: string;
      game_id: string;
      games: { sport: string } | null;
    }[];

    if (props.length === 0) {
      return NextResponse.json({ updated: 0, message: "No props with null player_id" });
    }

    // Group props by sport
    const nbaProps = props.filter((p) => !p.games?.sport || p.games.sport === "nba");
    const ncaabProps = props.filter((p) => p.games?.sport === "ncaab");

    let updated = 0;

    // --- NBA enrichment ---
    if (nbaProps.length > 0) {
      try {
        const allPlayers = await fetchAllPlayers();
        const playerMap = new Map<string, string>();
        for (const p of allPlayers) {
          playerMap.set(p.full_name.toLowerCase(), p.id);
          playerMap.set(normalizeName(p.full_name), p.id);
        }

        for (const prop of nbaProps) {
          const playerId = lookupPlayer(prop.player_name, playerMap);
          if (playerId) {
            const { error } = await (supabase.from("props") as any)
              .update({ player_id: playerId })
              .eq("id", prop.id);
            if (!error) updated++;
          }
        }
      } catch (err) {
        console.error("[Backfill] NBA enrichment failed:", err);
      }
    }

    // --- NCAAB enrichment ---
    if (ncaabProps.length > 0) {
      try {
        // Get all teams, then fetch all rosters
        const allTeams = await fetchNcaabTeams();
        const allTeamIds = [...new Set(Object.values(allTeams))];

        const ncaabMapping = await fetchNcaabPlayers(allTeamIds);
        const playerMap = new Map<string, string>();
        for (const [name, id] of Object.entries(ncaabMapping)) {
          playerMap.set(name, id);
          playerMap.set(normalizeName(name), id);
        }

        for (const prop of ncaabProps) {
          const playerId = lookupPlayer(prop.player_name, playerMap);
          if (playerId) {
            const { error } = await (supabase.from("props") as any)
              .update({ player_id: playerId })
              .eq("id", prop.id);
            if (!error) updated++;
          }
        }
      } catch (err) {
        console.error("[Backfill] NCAAB enrichment failed:", err);
      }
    }

    return NextResponse.json({
      total_null: props.length,
      nba_null: nbaProps.length,
      ncaab_null: ncaabProps.length,
      updated,
    });
  } catch (error) {
    return handleApiError(error, "Failed to backfill player IDs");
  }
}

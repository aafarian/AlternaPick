import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unauthorized, handleApiError } from "@/lib/api/errors";
import {
  getCategoryStats,
  getPlayerStats,
  getDirectionStats,
  getTrendData,
  getCardSizeStats,
  getTeamStats,
  getScoreDistribution,
  getGameModeStats,
} from "@/lib/analytics/queries";
import { isValidGameMode } from "@/lib/modes/definitions";
import type { GameMode } from "@/lib/supabase/types";

/**
 * All available analytics section keys.
 * When no `section` query param is provided, all sections are returned.
 */
const ALL_SECTIONS = [
  "categories",
  "players",
  "directions",
  "trend",
  "cardSizes",
  "teams",
  "scoreDistribution",
  "gameModes",
] as const;

type SectionKey = (typeof ALL_SECTIONS)[number];

/**
 * GET /api/analytics
 * Returns the authenticated user's prop pick analytics.
 *
 * Query params:
 *   - section (optional): comma-separated list of sections to return.
 *     e.g. ?section=categories,teams
 *     When omitted, all 8 sections are returned.
 *
 * Sections:
 *   - categories:         hit-rate by stat category
 *   - players:            top 10 players by pick volume
 *   - directions:         over vs under hit-rates
 *   - trend:              daily hit-rate over the last 30 days
 *   - cardSizes:          hit-rate grouped by card size
 *   - teams:              hit-rate grouped by team
 *   - scoreDistribution:  card count at each score for each card size
 *   - gameModes:          win-rate stats grouped by game mode
 *
 * Private, cached for 5 minutes client-side.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorized();
    }

    // Parse game mode filter
    const modeParam = request.nextUrl.searchParams.get("mode");
    const mode: GameMode | "all" | undefined =
      modeParam && isValidGameMode(modeParam) ? modeParam : modeParam === "all" ? "all" : undefined;

    // Parse requested sections from query param
    const sectionParam = request.nextUrl.searchParams.get("section");
    const requested: Set<SectionKey> = sectionParam
      ? new Set(
          sectionParam
            .split(",")
            .map((s) => s.trim())
            .filter((s): s is SectionKey =>
              ALL_SECTIONS.includes(s as SectionKey)
            )
        )
      : new Set(ALL_SECTIONS);

    // If the section param was provided but contained no valid keys, return all
    if (requested.size === 0) {
      for (const s of ALL_SECTIONS) requested.add(s);
    }

    // Build fetcher map: section key -> Promise
    const fetchers: Partial<Record<SectionKey, Promise<unknown>>> = {};

    if (requested.has("categories")) {
      fetchers.categories = getCategoryStats(supabase, user.id, mode);
    }
    if (requested.has("players")) {
      fetchers.players = getPlayerStats(supabase, user.id, 10, mode);
    }
    if (requested.has("directions")) {
      fetchers.directions = getDirectionStats(supabase, user.id, mode);
    }
    if (requested.has("trend")) {
      fetchers.trend = getTrendData(supabase, user.id, 30, mode);
    }
    if (requested.has("cardSizes")) {
      fetchers.cardSizes = getCardSizeStats(supabase, user.id, mode);
    }
    if (requested.has("teams")) {
      fetchers.teams = getTeamStats(supabase, user.id, 10, mode);
    }
    if (requested.has("scoreDistribution")) {
      fetchers.scoreDistribution = getScoreDistribution(supabase, user.id, mode);
    }
    if (requested.has("gameModes")) {
      fetchers.gameModes = getGameModeStats(supabase, user.id);
    }

    // Fetch all requested sections in parallel
    const keys = Object.keys(fetchers) as SectionKey[];
    const values = await Promise.all(keys.map((k) => fetchers[k]!));

    const result: Partial<Record<SectionKey, unknown>> = {};
    for (let i = 0; i < keys.length; i++) {
      result[keys[i]] = values[i];
    }

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch analytics");
  }
}

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/typed-queries";
import type {
  RecapData,
  PersonalHighlight,
  WeeklyRecapData,
  WeeklyPersonalStats,
} from "@/lib/recaps/compute";
import { getMondayOfWeek, getSundayOfWeek } from "@/lib/recaps/dates";
import {
  SlideUp,
  FadeIn,
  ScrollReveal,
} from "@/components/motion";
import { AnimatedEmptyState } from "@/components/ui/animated-empty-state";
import { YourDay } from "@/components/recap/YourDay";
import { DateNavigator } from "@/components/recap/DateNavigator";
import { RecapHeader } from "@/components/recap/RecapHeader";
import { PlatformStats } from "@/components/recap/PlatformStats";
import { ThisWeek } from "@/components/recap/ThisWeek";
import { RecapTileGrid } from "@/components/recap/RecapTileGrid";
import { ConsensusCard } from "@/components/recap/ConsensusCard";
import { Newspaper } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recap | Sports Tower",
  description: "Prop pick highlights and platform stats.",
};

interface RecapRow {
  id: string;
  recap_date: string;
  recap_data: RecapData;
  personal_highlights: Record<string, PersonalHighlight> | null;
  weekly_data: WeeklyRecapData | null;
  computed_at: string;
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Patch missing player IDs / sport / team from props table for old stored recaps */
async function patchPlayerIds(
  recapData: RecapData,
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const playerNames = new Set<string>();
  const allPlayerArrays = [
    recapData.mostPickedPlayers ?? [],
    recapData.mostPickedProps ?? [],
    recapData.trapProps ?? [],
    recapData.lockProps ?? [],
    recapData.playerSpotlightsGood ?? [],
    recapData.playerSpotlightsBad ?? [],
  ];
  for (const arr of allPlayerArrays) {
    for (const p of arr) {
      if (!p.playerId || !p.sport || p.sport === "unknown") {
        playerNames.add(p.playerName);
      }
    }
  }
  for (const s of recapData.spotlights ?? []) {
    if (s.subject && !s.playerId) playerNames.add(s.subject);
  }

  if (playerNames.size === 0) return;

  type PropLookup = {
    player_name: string;
    player_id: string | null;
    player_team: string | null;
    games: { sport: string } | null;
  };
  const { data: propRows } = await typedFrom(supabase, "props")
    .select("player_name, player_id, player_team, games:game_id(sport)")
    .in("player_name", [...playerNames])
    .not("player_id", "is", null)
    .limit(200);

  const playerLookup = new Map<string, { playerId: string; team: string | null; sport: string }>();
  for (const row of (propRows ?? []) as PropLookup[]) {
    if (row.player_id && !playerLookup.has(row.player_name)) {
      playerLookup.set(row.player_name, {
        playerId: row.player_id,
        team: row.player_team,
        sport: row.games?.sport ?? "unknown",
      });
    }
  }

  for (const arr of allPlayerArrays) {
    for (const p of arr) {
      const info = playerLookup.get(p.playerName);
      if (!info) continue;
      if (!p.playerId) p.playerId = info.playerId;
      if (!p.team) p.team = info.team;
      if (!p.sport || p.sport === "unknown") p.sport = info.sport;
    }
  }
  for (const s of recapData.spotlights ?? []) {
    if (s.subject && !s.playerId) {
      const info = playerLookup.get(s.subject);
      if (info) {
        s.playerId = info.playerId;
        if (!s.team) s.team = info.team ?? undefined;
        if (!s.sport) s.sport = info.sport;
      }
    }
  }
}

/**
 * Patch missing perfect card entries for stored recaps.
 * Uses the stored userIds to look up the actual perfect cards — more reliable
 * than date-range matching which can miss cards resolved at UTC boundaries.
 */
async function patchPerfectCards(recapData: RecapData) {
  if (
    !recapData.perfectCards?.count ||
    recapData.perfectCards.count === 0 ||
    (recapData.perfectCards.entries && recapData.perfectCards.entries.length > 0)
  ) {
    return;
  }

  const userIds = recapData.perfectCards.userIds ?? [];
  if (userIds.length === 0) return;

  const adminClient = createAdminClient();

  // Find perfect cards (score === total_picks) for these users
  type CardRow = { id: string; user_id: string; score: number; total_picks: number };
  const { data: cardRows } = await typedFrom(adminClient, "cards")
    .select("id, user_id, score, total_picks")
    .eq("status", "resolved")
    .in("user_id", userIds)
    .gte("total_picks", 3)
    .order("resolved_at", { ascending: false });

  const perfectCards = ((cardRows ?? []) as CardRow[]).filter(
    (c) => c.score === c.total_picks,
  );

  // Dedupe: keep only the most recent perfect card per user
  const seenUsers = new Set<string>();
  const dedupedCards: CardRow[] = [];
  for (const c of perfectCards) {
    if (!seenUsers.has(c.user_id)) {
      seenUsers.add(c.user_id);
      dedupedCards.push(c);
    }
  }

  // Build username lookup from existing data or profiles table
  const usernameMap = new Map<string, string>();
  const existingUsernames = recapData.perfectCards.usernames ?? [];
  // If we have usernames in the same order as userIds, map them
  for (let i = 0; i < userIds.length && i < existingUsernames.length; i++) {
    usernameMap.set(userIds[i], existingUsernames[i]);
  }

  // Fill in any missing usernames from profiles
  const missingIds = userIds.filter((id) => !usernameMap.has(id));
  if (missingIds.length > 0) {
    const { data: profileRows } = await typedFrom(adminClient, "profiles")
      .select("id, username")
      .in("id", missingIds);
    for (const r of (profileRows ?? []) as { id: string; username: string | null }[]) {
      if (r.username) usernameMap.set(r.id, r.username);
    }
  }

  recapData.perfectCards.entries = dedupedCards
    .filter((c) => usernameMap.has(c.user_id))
    .map((c) => ({
      userId: c.user_id,
      username: usernameMap.get(c.user_id)!,
      cardId: c.id,
      score: c.score,
      totalPicks: c.total_picks,
    }));
}

/** Build personal weekly stats from recap rows for a given user */
function buildPersonalWeekly(
  rows: { recap_date: string; personal_highlights: Record<string, PersonalHighlight> | null }[],
  userId: string,
  platformWeeklyHitRate: number,
): WeeklyPersonalStats | null {
  let hitCards = 0;
  let totalCards = 0;
  const dailyTrend: WeeklyPersonalStats["dailyTrend"] = [];

  for (const row of rows) {
    const userDay = row.personal_highlights?.[userId];
    if (!userDay) {
      dailyTrend.push({ date: row.recap_date, hitRate: 0, cards: 0 });
      continue;
    }
    const dayCards = userDay.cardsPlayed;
    const dayHitRate = userDay.hitRate;
    totalCards += dayCards;
    hitCards += Math.round(dayHitRate * dayCards);
    dailyTrend.push({ date: row.recap_date, hitRate: dayHitRate, cards: dayCards });
  }

  if (totalCards === 0) return null;

  return {
    weeklyHitRate: Math.round((hitCards / totalCards) * 1000) / 1000,
    totalCards,
    platformWeeklyHitRate,
    dailyTrend,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RecapPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; mode?: string }>;
}) {
  const { date: dateParam, mode: modeParam } = await searchParams;
  const mode = modeParam === "weekly" ? "weekly" : "daily";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch available recap dates for the DateNavigator.
  // Exclude weekly-only stub rows that have no real daily recap data.
  const { data: dateRows } = await typedFrom(supabase, "recaps")
    .select("recap_date")
    .not("recap_data", "eq", "{}")
    .order("recap_date", { ascending: true });

  const availableDates: string[] = (dateRows ?? []).map(
    (r: { recap_date: string }) => r.recap_date,
  );

  // ── WEEKLY MODE ──
  if (mode === "weekly") {
    const todayStr = new Date().toISOString().slice(0, 10);
    const requestedDate = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : (availableDates.length > 0 ? availableDates[availableDates.length - 1] : todayStr);

    let monday = getMondayOfWeek(requestedDate);
    let sunday = getSundayOfWeek(monday);

    // Don't show incomplete weeks — if Sunday hasn't passed, fall back to prior week
    if (sunday >= todayStr) {
      const priorMonday = new Date(`${monday}T00:00:00Z`);
      priorMonday.setUTCDate(priorMonday.getUTCDate() - 7);
      monday = priorMonday.toISOString().slice(0, 10);
      sunday = getSundayOfWeek(monday);
    }

    // Fetch all recap rows in the week range
    const { data: weekRecapRows } = await typedFrom(supabase, "recaps")
      .select("*")
      .gte("recap_date", monday)
      .lte("recap_date", sunday)
      .order("recap_date", { ascending: true });

    let typedWeekRows = (weekRecapRows ?? []) as RecapRow[];

    // Find the row that has weekly_data (typically the Sunday row, or any row in the range)
    let weeklyRow = typedWeekRows.find((r) => r.weekly_data) ?? null;
    let weeklyData = weeklyRow?.weekly_data ?? null;

    // If the selected week has no weekly_data, fall back to the latest week
    // that does. This handles switching to weekly mode when the current week
    // is incomplete, or navigating to a week that was never computed.
    if (!weeklyData) {
      const { data: latestWeeklyRow } = await typedFrom(supabase, "recaps")
        .select("*")
        .not("weekly_data", "is", null)
        .order("recap_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestWeeklyRow) {
        const fallback = latestWeeklyRow as RecapRow;
        monday = getMondayOfWeek(fallback.recap_date);
        sunday = getSundayOfWeek(monday);
        // Fetch the full week for this fallback
        const { data: fallbackRows } = await typedFrom(supabase, "recaps")
          .select("*")
          .gte("recap_date", monday)
          .lte("recap_date", sunday)
          .order("recap_date", { ascending: true });
        typedWeekRows = (fallbackRows ?? []) as RecapRow[];
        weeklyRow = typedWeekRows.find((r) => r.weekly_data) ?? fallback;
        weeklyData = weeklyRow?.weekly_data ?? fallback.weekly_data;
      }
    }

    // Format week range for display
    const monDate = new Date(`${monday}T00:00:00Z`);
    const sunDate = new Date(`${sunday}T00:00:00Z`);
    const monLabel = monDate.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    const sunLabel = sunDate.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    const weekLabel = `${monLabel} - ${sunLabel}`;

    if (!weeklyData) {
      return (
        <div className="flex flex-col gap-6 py-8">
          <SlideUp>
            <RecapHeader title="Weekly Recap" subtitle={weekLabel} mode="weekly" />
          </SlideUp>
          {availableDates.length > 0 && (
            <FadeIn delay={0.05}>
              <DateNavigator
                currentDate={monday}
                availableDates={availableDates}
                mode="weekly"
              />
            </FadeIn>
          )}
          <FadeIn delay={0.2}>
            <AnimatedEmptyState
              icon={<Newspaper className="h-8 w-8" />}
              title="No weekly recap available"
              description="Check back after the week wraps up!"
            />
          </FadeIn>
        </div>
      );
    }

    const weeklyRecapData = weeklyData.recapData ?? null;

    if (weeklyRecapData) {
      await patchPlayerIds(weeklyRecapData, supabase);
      await patchPerfectCards(weeklyRecapData);
    }

    const weeklyHitPercent = Math.round(weeklyData.weeklyHitRate * 100);
    const personalWeekly = user
      ? buildPersonalWeekly(typedWeekRows, user.id, weeklyData.weeklyHitRate)
      : null;

    return (
      <div key={monday} className="flex flex-col gap-6 py-8">
        {/* Header + Mode Toggle */}
        <SlideUp>
          <RecapHeader
            title={`Weekly Recap \u2014 ${weekLabel}`}
            subtitle={`${weeklyData.totalPicks.toLocaleString()} pick${weeklyData.totalPicks !== 1 ? "s" : ""} across ${weeklyData.totalCards.toLocaleString()} card${weeklyData.totalCards !== 1 ? "s" : ""}`}
            mode="weekly"
          />
        </SlideUp>

        {/* Date Navigator (weekly pills) */}
        {availableDates.length > 0 && (
          <FadeIn delay={0.05}>
            <DateNavigator
              currentDate={monday}
              availableDates={availableDates}
              mode="weekly"
            />
          </FadeIn>
        )}

        {/* Platform Overview Stats */}
        <FadeIn delay={0.08}>
          <section aria-label="Platform Overview" data-section="platform-overview">
            <PlatformStats
              totalPicks={weeklyData.totalPicks}
              totalCards={weeklyData.totalCards}
              hitRatePercent={weeklyHitPercent}
            />
          </section>
        </FadeIn>

        {/* This Week — trend chart */}
        <ScrollReveal>
          <section aria-label="This Week" data-section="this-week">
            <ThisWeek weeklyData={weeklyData} personalWeekly={personalWeekly} hideStats />
          </section>
        </ScrollReveal>

        {/* Tile Grid — weekly aggregated data */}
        {weeklyRecapData && (
          <FadeIn delay={0.15}>
            <section aria-label="Highlights" data-section="highlights">
              <RecapTileGrid recapData={weeklyRecapData} />
            </section>
          </FadeIn>
        )}
      </div>
    );
  }

  // ── DAILY MODE ──

  // Fetch the recap for the requested date, or fall back to the most recent.
  // Filter out weekly-only rows (empty recap_data) that have no daily recap.
  let query = typedFrom(supabase, "recaps")
    .select("*")
    .not("recap_data", "eq", "{}");

  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    query = query.eq("recap_date", dateParam);
  } else {
    query = query.order("recap_date", { ascending: false }).limit(1);
  }

  const { data: recap, error } = await query.maybeSingle();

  if (error) {
    console.error("Failed to fetch recap:", error.message);
  }

  const typedRecap = recap as RecapRow | null;

  // Empty state — no recap available (or weekly-only row with no daily data)
  if (!typedRecap || !typedRecap.recap_data?.totalPicks) {
    return (
      <div className="flex flex-col gap-6 py-8">
        <SlideUp>
          <RecapHeader
            title="Daily Recap"
            subtitle="Yesterday's prop pick highlights and platform stats"
            mode="daily"
          />
        </SlideUp>
        {availableDates.length > 0 && dateParam && (
          <FadeIn delay={0.1}>
            <DateNavigator
              currentDate={dateParam}
              availableDates={availableDates}
            />
          </FadeIn>
        )}
        <FadeIn delay={0.2}>
          <AnimatedEmptyState
            icon={<Newspaper className="h-8 w-8" />}
            title="No recap available"
            description="Check back after games resolve!"
          />
        </FadeIn>
      </div>
    );
  }

  const recapData = typedRecap.recap_data;
  const personalHighlights: PersonalHighlight | null =
    user && typedRecap.personal_highlights
      ? (typedRecap.personal_highlights[user.id] ?? null)
      : null;

  const currentDate = typedRecap.recap_date;

  // Patch missing data from old stored recaps
  await patchPlayerIds(recapData, supabase);
  await patchPerfectCards(recapData);

  // Format the recap date for display
  const dateLabel = new Date(`${currentDate}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  const platformHitPercent = Math.round(recapData.platformHitRate * 100);

  return (
    <div key={currentDate} className="flex flex-col gap-6 py-8">
      {/* 1. Header + Mode Toggle + Date Navigator */}
      <SlideUp>
        <RecapHeader
          title={`Daily Recap \u2014 ${dateLabel}`}
          subtitle={`${recapData.totalPicks.toLocaleString()} pick${recapData.totalPicks !== 1 ? "s" : ""} across ${recapData.totalCards.toLocaleString()} card${recapData.totalCards !== 1 ? "s" : ""}`}
          mode="daily"
        />
      </SlideUp>

      {availableDates.length > 0 && (
        <FadeIn delay={0.05}>
          <DateNavigator
            currentDate={currentDate}
            availableDates={availableDates}
          />
        </FadeIn>
      )}

      {/* 2. Platform Overview Stats */}
      <FadeIn delay={0.08}>
        <section aria-label="Platform Overview" data-section="platform-overview">
          <PlatformStats
            totalPicks={recapData.totalPicks}
            totalCards={recapData.totalCards}
            hitRatePercent={platformHitPercent}
          />
        </section>
      </FadeIn>

      {/* 3. Your Day (logged-in users only) */}
      {personalHighlights && (
        <FadeIn delay={0.12}>
          <section aria-label="Your Day" data-section="your-day">
            <YourDay highlight={personalHighlights} />
          </section>
        </FadeIn>
      )}

      {/* 4. Consensus Picks */}
      {recapData.consensusPicks?.length > 0 && (
        <ScrollReveal>
          <section aria-label="Consensus Picks" data-section="consensus-picks">
            <ConsensusCard picks={recapData.consensusPicks} />
          </section>
        </ScrollReveal>
      )}

      {/* 5. Tile Grid — spotlights, most picked, breakdowns, traps, locks, etc. */}
      <FadeIn delay={0.15}>
        <section aria-label="Highlights" data-section="highlights">
          <RecapTileGrid recapData={recapData} />
        </section>
      </FadeIn>

    </div>
  );
}

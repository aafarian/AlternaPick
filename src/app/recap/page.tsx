import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/typed-queries";
import type {
  RecapData,
  PersonalHighlight,
  WeeklyRecapData,
  WeeklyPersonalStats,
} from "@/lib/recaps/compute";
import {
  SlideUp,
  FadeIn,
  ScrollReveal,
  StaggerChildren,
  StaggerItem,
} from "@/components/motion";
import { AnimatedNumber } from "@/components/recap/AnimatedNumber";
import { AnimatedEmptyState } from "@/components/ui/animated-empty-state";
import { YourDay } from "@/components/recap/YourDay";
import { DateNavigator } from "@/components/recap/DateNavigator";
import { ThisWeek } from "@/components/recap/ThisWeek";
import { RecapTileGrid } from "@/components/recap/RecapTileGrid";
import { ConsensusCard } from "@/components/recap/ConsensusCard";
import { Newspaper, BarChart3, Hash, Target } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Daily Recap | Sports Tower",
  description: "Yesterday's prop pick highlights and platform stats.",
};

interface RecapRow {
  id: string;
  recap_date: string;
  recap_data: RecapData;
  personal_highlights: Record<string, PersonalHighlight> | null;
  weekly_data: WeeklyRecapData | null;
  computed_at: string;
}

export default async function RecapPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const supabase = await createClient();

  // Auth is optional — show global data to everyone, personal section only for logged-in users
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch available recap dates for the DateNavigator
  const { data: dateRows } = await typedFrom(supabase, "recaps")
    .select("recap_date")
    .order("recap_date", { ascending: true });

  const availableDates: string[] = (dateRows ?? []).map(
    (r: { recap_date: string }) => r.recap_date,
  );

  // Fetch the recap for the requested date, or fall back to the most recent
  let query = typedFrom(supabase, "recaps").select("*");

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

  // Empty state — no recap available
  if (!typedRecap) {
    return (
      <div className="flex flex-col gap-6 py-8">
        <SlideUp>
          <h1 className="text-2xl font-bold tracking-tight">Daily Recap</h1>
          <p className="text-sm text-muted-foreground">
            Yesterday&apos;s prop pick highlights and platform stats
          </p>
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
  const weeklyData = typedRecap.weekly_data ?? null;
  const personalHighlights: PersonalHighlight | null =
    user && typedRecap.personal_highlights
      ? (typedRecap.personal_highlights[user.id] ?? null)
      : null;

  const currentDate = typedRecap.recap_date;

  // ── Patch missing player IDs / sport / team from props table ──
  // Old stored recaps don't have playerId, sport, or team fields.
  // Query the props table to fill them in at render time.
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
  // Also check spotlight tiles that reference players
  for (const s of recapData.spotlights ?? []) {
    if (s.subject && !s.playerId) playerNames.add(s.subject);
  }

  if (playerNames.size > 0) {
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

    // Build lookup: player_name → { playerId, team, sport }
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

    // Patch all arrays
    for (const arr of allPlayerArrays) {
      for (const p of arr) {
        const info = playerLookup.get(p.playerName);
        if (!info) continue;
        if (!p.playerId) p.playerId = info.playerId;
        if (!p.team) p.team = info.team;
        if (!p.sport || p.sport === "unknown") p.sport = info.sport;
      }
    }
    // Patch spotlight tiles too
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

  // ── Patch missing perfect card usernames ──
  // Old stored data has perfectCards.userIds/usernames as empty arrays.
  // Re-query cards table the same way the compute does.
  if (
    recapData.perfectCards?.count > 0 &&
    (!recapData.perfectCards.usernames || recapData.perfectCards.usernames.length === 0)
  ) {
    const dayStart = `${currentDate}T00:00:00Z`;
    const nextDay = new Date(`${currentDate}T00:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const dayEnd = nextDay.toISOString();

    // Step 1: Find perfect cards (score === total_picks, 3+ picks)
    // Use admin client to bypass RLS — cards_select_own restricts to own cards
    const adminClient = createAdminClient();
    const { data: cardRows } = await typedFrom(adminClient, "cards")
      .select("id, user_id, score, total_picks")
      .eq("status", "resolved")
      .gte("resolved_at", dayStart)
      .lt("resolved_at", dayEnd)
      .gte("total_picks", 3);

    type CardRow = { id: string; user_id: string | null; score: number; total_picks: number };
    const perfectCards = ((cardRows ?? []) as CardRow[]).filter(
      (c) => c.user_id && c.score === c.total_picks,
    );

    const perfectUserIds = [...new Set(perfectCards.map((c) => c.user_id!))];

    // Step 2: Look up usernames and build entries
    if (perfectUserIds.length > 0) {
      const { data: profileRows } = await typedFrom(supabase, "profiles")
        .select("id, username")
        .in("id", perfectUserIds);

      const usernameMap = new Map<string, string>();
      for (const r of (profileRows ?? []) as { id: string; username: string | null }[]) {
        if (r.username) usernameMap.set(r.id, r.username);
      }

      recapData.perfectCards.userIds = perfectUserIds;
      recapData.perfectCards.usernames = [...usernameMap.values()];
      recapData.perfectCards.entries = perfectCards
        .filter((c) => usernameMap.has(c.user_id!))
        .map((c) => ({
          userId: c.user_id!,
          username: usernameMap.get(c.user_id!)!,
          cardId: c.id,
          score: c.score,
          totalPicks: c.total_picks,
        }));
    }
  }

  // ── Compute weekly personal stats for authenticated users ──────────
  let personalWeekly: WeeklyPersonalStats | null = null;

  if (user && weeklyData) {
    const endDate = currentDate;
    const startDate = new Date(`${endDate}T00:00:00Z`);
    startDate.setUTCDate(startDate.getUTCDate() - 6);
    const startStr = startDate.toISOString().slice(0, 10);

    const { data: weekRows } = await typedFrom(supabase, "recaps")
      .select("recap_date, personal_highlights")
      .gte("recap_date", startStr)
      .lte("recap_date", endDate)
      .order("recap_date", { ascending: true });

    type PersonalRecapRow = {
      recap_date: string;
      personal_highlights: Record<string, PersonalHighlight> | null;
    };
    const typedWeekRows = (weekRows ?? []) as PersonalRecapRow[];

    let totalHits = 0;
    let totalPicksCount = 0;
    let totalCardsCount = 0;
    const dailyTrend: WeeklyPersonalStats["dailyTrend"] = [];

    for (const row of typedWeekRows) {
      const userDay = row.personal_highlights?.[user.id];
      if (!userDay) {
        dailyTrend.push({ date: row.recap_date, hitRate: 0, picks: 0 });
        continue;
      }
      const dayCards = userDay.cardsPlayed;
      const dayHitRate = userDay.hitRate;
      totalCardsCount += dayCards;
      totalHits += Math.round(dayHitRate * dayCards);
      totalPicksCount += dayCards;
      dailyTrend.push({
        date: row.recap_date,
        hitRate: dayHitRate,
        picks: dayCards,
      });
    }

    if (totalPicksCount > 0) {
      personalWeekly = {
        weeklyHitRate: Math.round((totalHits / totalPicksCount) * 1000) / 1000,
        totalPicks: totalPicksCount,
        totalCards: totalCardsCount,
        platformWeeklyHitRate: weeklyData.weeklyHitRate,
        dailyTrend,
      };
    }
  }

  // Format the recap date for display (e.g., "Feb 19")
  const recapDate = new Date(`${currentDate}T00:00:00Z`);
  const dateLabel = recapDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  const platformHitPercent = Math.round(recapData.platformHitRate * 100);

  return (
    <div className="flex flex-col gap-6 py-8">
      {/* 1. Header + Date Navigator */}
      <SlideUp>
        <h1 className="text-2xl font-bold tracking-tight">
          Daily Recap &mdash; {dateLabel}
        </h1>
        <p className="text-sm text-muted-foreground">
          {recapData.totalPicks.toLocaleString()} pick
          {recapData.totalPicks !== 1 ? "s" : ""} across{" "}
          {recapData.totalCards.toLocaleString()} card
          {recapData.totalCards !== 1 ? "s" : ""}
        </p>
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
          <StaggerChildren className="grid grid-cols-3 gap-3" staggerDelay={0.1}>
            <StaggerItem>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Total Picks
                  </p>
                </div>
                <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
                  <AnimatedNumber value={recapData.totalPicks} />
                </p>
              </div>
            </StaggerItem>
            <StaggerItem>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Total Cards
                  </p>
                </div>
                <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
                  <AnimatedNumber value={recapData.totalCards} />
                </p>
              </div>
            </StaggerItem>
            <StaggerItem>
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Hit Rate
                  </p>
                </div>
                <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
                  <AnimatedNumber value={platformHitPercent} suffix="%" />
                </p>
              </div>
            </StaggerItem>
          </StaggerChildren>
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

      {/* 6. This Week — weekly summary section */}
      {weeklyData && (
        <ScrollReveal>
          <section aria-label="This Week" data-section="this-week">
            <ThisWeek weeklyData={weeklyData} personalWeekly={personalWeekly} />
          </section>
        </ScrollReveal>
      )}
    </div>
  );
}

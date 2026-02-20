import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/typed-queries";
import type { RecapData, PersonalHighlight } from "@/lib/recaps/compute";
import { SlideUp, FadeIn, ScrollReveal } from "@/components/motion";
import { AnimatedEmptyState } from "@/components/ui/animated-empty-state";
import { YourDay } from "@/components/recap/YourDay";
import { PropCalloutCard } from "@/components/recap/PropCalloutCard";
import { PlayerSpotlightCard } from "@/components/recap/PlayerSpotlightCard";
import { PerfectCardsCard } from "@/components/recap/PerfectCardsCard";
import { MostPickedCard } from "@/components/recap/MostPickedCard";
import { BreakdownCard } from "@/components/recap/BreakdownCard";
import { Newspaper, BarChart3, Hash, Target } from "lucide-react";

export const metadata = {
  title: "Daily Recap | Sports Tower",
  description: "Yesterday's prop pick highlights and platform stats.",
};

interface RecapRow {
  id: string;
  recap_date: string;
  recap_data: RecapData;
  personal_highlights: Record<string, PersonalHighlight> | null;
  computed_at: string;
}

export default async function RecapPage() {
  const supabase = await createClient();

  // Auth is optional — show global data to everyone, personal section only for logged-in users
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch the most recent recap
  const { data: recap, error } = await typedFrom(supabase, "recaps")
    .select("*")
    .order("recap_date", { ascending: false })
    .limit(1)
    .maybeSingle();

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

  // Format the recap date for display (e.g., "Feb 19")
  const recapDate = new Date(`${typedRecap.recap_date}T00:00:00Z`);
  const dateLabel = recapDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

  const platformHitPercent = Math.round(recapData.platformHitRate * 100);

  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Page Header */}
      <SlideUp>
        <h1 className="text-2xl font-bold tracking-tight">Daily Recap</h1>
        <p className="text-sm text-muted-foreground">
          {dateLabel} &mdash; {recapData.totalPicks.toLocaleString()} pick
          {recapData.totalPicks !== 1 ? "s" : ""} across{" "}
          {recapData.totalCards.toLocaleString()} card
          {recapData.totalCards !== 1 ? "s" : ""}
        </p>
      </SlideUp>

      {/* Personal Highlights — Your Day (logged-in users only) */}
      {personalHighlights && (
        <FadeIn delay={0.1}>
          <section aria-label="Your Day" data-section="your-day">
            <YourDay highlight={personalHighlights} />
          </section>
        </FadeIn>
      )}

      {/* Platform Overview Stats */}
      <FadeIn delay={0.15}>
        <section aria-label="Platform Overview" data-section="platform-overview">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-1.5">
                <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Total Picks
                </p>
              </div>
              <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
                {recapData.totalPicks.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-1.5">
                <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Total Cards
                </p>
              </div>
              <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
                {recapData.totalCards.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Hit Rate
                </p>
              </div>
              <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
                {platformHitPercent}%
              </p>
            </div>
          </div>
        </section>
      </FadeIn>

      {/* Callout Cards Grid — 2 columns on desktop, 1 on mobile */}
      <ScrollReveal>
        <section
          aria-label="Callout Cards"
          data-section="callout-cards"
          className="grid gap-4 lg:grid-cols-2"
        >
          <PropCalloutCard props={recapData.trapProps} variant="trap" />
          <PropCalloutCard props={recapData.lockProps} variant="lock" />
          <PlayerSpotlightCard
            good={recapData.playerSpotlightsGood}
            bad={recapData.playerSpotlightsBad}
          />
          <PerfectCardsCard data={recapData.perfectCards} />
        </section>
      </ScrollReveal>

      {/* Most Picked Section */}
      <ScrollReveal>
        <section aria-label="Most Picked" data-section="most-picked">
          <MostPickedCard
            players={recapData.mostPickedPlayers}
            props={recapData.mostPickedProps}
          />
        </section>
      </ScrollReveal>

      {/* Breakdowns Section */}
      <ScrollReveal>
        <section aria-label="Breakdowns" data-section="breakdowns">
          <BreakdownCard
            statCategories={recapData.statCategoryBreakdown}
            sports={recapData.sportBreakdown}
          />
        </section>
      </ScrollReveal>
    </div>
  );
}

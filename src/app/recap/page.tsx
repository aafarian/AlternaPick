import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/typed-queries";
import type { RecapData, PersonalHighlight } from "@/lib/recaps/compute";
import { SlideUp, FadeIn } from "@/components/motion";
import { AnimatedEmptyState } from "@/components/ui/animated-empty-state";
import { YourDay } from "@/components/recap/YourDay";
import { Newspaper } from "lucide-react";

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

      {/* Personal Highlights — Your Day */}
      {personalHighlights && (
        <FadeIn delay={0.1}>
          <section aria-label="Your Day" data-section="your-day">
            <YourDay highlight={personalHighlights} />
          </section>
        </FadeIn>
      )}

      {/* Trap Props (Wave 2 component slot) */}
      {recapData.trapProps.length > 0 && (
        <FadeIn delay={0.15}>
          <section aria-label="Trap Props" data-section="trap-props">
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-bold tracking-tight">Trap Props</h2>
              <p className="text-sm text-muted-foreground">
                {recapData.trapProps.length} prop
                {recapData.trapProps.length !== 1 ? "s" : ""} with low hit rates
              </p>
            </div>
          </section>
        </FadeIn>
      )}

      {/* Lock Props (Wave 2 component slot) */}
      {recapData.lockProps.length > 0 && (
        <FadeIn delay={0.2}>
          <section aria-label="Lock Props" data-section="lock-props">
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-bold tracking-tight">Lock Props</h2>
              <p className="text-sm text-muted-foreground">
                {recapData.lockProps.length} prop
                {recapData.lockProps.length !== 1 ? "s" : ""} with high hit
                rates
              </p>
            </div>
          </section>
        </FadeIn>
      )}

      {/* Player Spotlights (Wave 2 component slot) */}
      {(recapData.playerSpotlightsGood.length > 0 ||
        recapData.playerSpotlightsBad.length > 0) && (
        <FadeIn delay={0.25}>
          <section
            aria-label="Player Spotlights"
            data-section="player-spotlights"
          >
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-bold tracking-tight">
                Player Spotlights
              </h2>
              <p className="text-sm text-muted-foreground">
                {recapData.playerSpotlightsGood.length +
                  recapData.playerSpotlightsBad.length}{" "}
                notable player performance
                {recapData.playerSpotlightsGood.length +
                  recapData.playerSpotlightsBad.length !==
                1
                  ? "s"
                  : ""}
              </p>
            </div>
          </section>
        </FadeIn>
      )}

      {/* Perfect Cards (Wave 2 component slot) */}
      {recapData.perfectCards.count > 0 && (
        <FadeIn delay={0.3}>
          <section aria-label="Perfect Cards" data-section="perfect-cards">
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-bold tracking-tight">
                Perfect Cards
              </h2>
              <p className="text-sm text-muted-foreground">
                {recapData.perfectCards.count} perfect card
                {recapData.perfectCards.count !== 1 ? "s" : ""} yesterday
              </p>
            </div>
          </section>
        </FadeIn>
      )}

      {/* Most Picked (Wave 2 component slot) */}
      {recapData.mostPickedProps.length > 0 && (
        <FadeIn delay={0.35}>
          <section aria-label="Most Picked" data-section="most-picked">
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-bold tracking-tight">Most Picked</h2>
              <p className="text-sm text-muted-foreground">
                Top {recapData.mostPickedProps.length} most popular prop
                {recapData.mostPickedProps.length !== 1 ? "s" : ""}
              </p>
            </div>
          </section>
        </FadeIn>
      )}

      {/* Breakdowns (Wave 2 component slot) */}
      {(recapData.statCategoryBreakdown.length > 0 ||
        recapData.sportBreakdown.length > 0) && (
        <FadeIn delay={0.4}>
          <section aria-label="Breakdowns" data-section="breakdowns">
            <div className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-bold tracking-tight">Breakdowns</h2>
              <p className="text-sm text-muted-foreground">
                Hit rates by stat category and sport
              </p>
            </div>
          </section>
        </FadeIn>
      )}
    </div>
  );
}

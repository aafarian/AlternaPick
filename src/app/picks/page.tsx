import Link from "next/link";
import { redirect } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import CardListWithLoadMore from "@/components/cards/CardListWithLoadMore";
import LiveTracker from "@/components/live/LiveTracker";
import PicksTabs from "@/components/picks/PicksTabs";
import { CARD_SELECT, type CardWithPicks } from "@/lib/cards/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Target, BarChart3, Trophy, Activity } from "lucide-react";
import { SlideUp, FadeIn, StaggerChildren, StaggerItem } from "@/components/motion";
import { AnimatedEmptyState } from "@/components/ui/animated-empty-state";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function StatCard({ icon, value, label, valueClassName }: { icon: ReactNode; value: ReactNode; label: string; valueClassName?: string }) {
  return (
    <StaggerItem>
      <Card className="border-border bg-card hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
        <CardContent className="flex flex-col items-center gap-1 p-4">
          {icon}
          <span className={cn("text-2xl font-black", valueClassName)}>{value}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        </CardContent>
      </Card>
    </StaggerItem>
  );
}

async function getCardsByStatus(
  userId: string,
  status: "locked" | "resolved",
  limit: number = PAGE_SIZE,
): Promise<CardWithPicks[]> {
  const supabase = await createClient();

  const result = await (supabase.from("cards") as any)
    .select(CARD_SELECT)
    .eq("user_id", userId)
    .eq("status", status)
    .gt("total_picks", 0)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (result.data ?? []) as CardWithPicks[];
}

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirectTo=/picks");
  }

  const { tab } = await searchParams;
  const defaultTab = tab === "finished" ? "finished" : "live";

  // Fetch locked and resolved cards separately for proper pagination
  const [activeCards, completedCards] = await Promise.all([
    getCardsByStatus(user.id, "locked"),
    getCardsByStatus(user.id, "resolved", PAGE_SIZE),
  ]);

  const totalHits = completedCards.reduce((sum, c) => sum + c.score, 0);
  const totalAttempted = completedCards.reduce((sum, c) => sum + c.total_picks, 0);
  const hitRate =
    totalAttempted > 0
      ? Math.round((totalHits / totalAttempted) * 100)
      : null;

  // Find the best card (highest score) and its total picks
  const bestCard =
    completedCards.length > 0
      ? completedCards.reduce((best, c) => (c.score > best.score ? c : best), completedCards[0])
      : null;

  return (
    <div className="flex flex-col gap-8 py-8">
      {/* Header */}
      <SlideUp>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">My Picks</h1>
          <Link href="/props">
            <Button size="sm">
              <Plus className="mr-1.5 h-4 w-4" />
              New Card
            </Button>
          </Link>
        </div>
      </SlideUp>

      {/* Stats summary */}
      {(completedCards.length > 0 || activeCards.length > 0) && (
        <StaggerChildren className="grid grid-cols-2 gap-4 md:grid-cols-4" staggerDelay={0.08}>
          <StatCard
            icon={<Activity className="h-5 w-5 text-primary" />}
            value={activeCards.length}
            label="Active"
          />
          <StatCard
            icon={<Target className="h-5 w-5 text-muted-foreground" />}
            value={completedCards.length}
            label="Completed"
          />
          <StatCard
            icon={<BarChart3 className="h-5 w-5 text-muted-foreground" />}
            value={hitRate != null ? `${hitRate}%` : "—"}
            label="Hit Rate"
          />
          <StatCard
            icon={<Trophy className="h-5 w-5 text-neon-green" />}
            value={bestCard ? `${bestCard.score}/${bestCard.total_picks}` : "—"}
            label="Best"
            valueClassName="text-neon-green"
          />
        </StaggerChildren>
      )}

      {/* Tabs for Live / Finished */}
      <FadeIn delay={0.15}>
        <Suspense>
          <PicksTabs
            defaultTab={defaultTab}
            liveCount={activeCards.length}
            finishedCount={completedCards.length}
            liveContent={<LiveTracker initialCards={activeCards} />}
            finishedContent={
              completedCards.length === 0 ? (
                <AnimatedEmptyState
                  icon="&#x1F4CA;"
                  title="No finished cards yet"
                  description="Complete some picks to see your results here."
                />
              ) : (
                <CardListWithLoadMore
                  initialCards={completedCards}
                  statusFilter="resolved"
                  pageSize={PAGE_SIZE}
                  hasMoreInitially={completedCards.length >= PAGE_SIZE}
                />
              )
            }
          />
        </Suspense>
      </FadeIn>
    </div>
  );
}

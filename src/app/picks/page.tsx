import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import CardListWithLoadMore from "@/components/cards/CardListWithLoadMore";
import LiveTracker from "@/components/live/LiveTracker";
import PicksTabs from "@/components/picks/PicksTabs";
import { CARD_SELECT, type CardWithPicks } from "@/lib/cards/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Target, BarChart3, Trophy } from "lucide-react";

const PAGE_SIZE = 20;

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
    <div className="mx-auto flex max-w-2xl flex-col gap-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">My Picks</h1>
        <Link href="/props">
          <Button size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            New Card
          </Button>
        </Link>
      </div>

      {/* Stats summary */}
      {completedCards.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="border-border bg-card">
            <CardContent className="flex flex-col items-center gap-1 p-4">
              <Target className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-black">{completedCards.length}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Completed</span>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="flex flex-col items-center gap-1 p-4">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <span className="text-2xl font-black">{hitRate}%</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Hit Rate</span>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="flex flex-col items-center gap-1 p-4">
              <Trophy className="h-5 w-5 text-neon-green" />
              <span className="text-2xl font-black text-neon-green">{bestCard?.score}/{bestCard?.total_picks}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Best</span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs for Live / Finished */}
      <Suspense>
        <PicksTabs
          defaultTab={defaultTab}
          liveCount={activeCards.length}
          finishedCount={completedCards.length}
          liveContent={<LiveTracker initialCards={activeCards} />}
          finishedContent={
            completedCards.length === 0 ? (
              <Card className="border-border bg-card">
                <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                  <span className="text-3xl">&#x1F4CA;</span>
                  <p className="text-muted-foreground">No finished cards yet</p>
                </CardContent>
              </Card>
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
    </div>
  );
}

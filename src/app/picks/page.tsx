import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CardListWithLoadMore from "@/components/cards/CardListWithLoadMore";
import LiveTracker from "@/components/live/LiveTracker";
import type { CardWithPicks } from "@/lib/cards/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Target, BarChart3, Trophy } from "lucide-react";

const PAGE_SIZE = 20;

const CARD_SELECT = "id, user_id, status, score, total_picks, locked_at, resolved_at, created_at, challenge_id, picks(id, card_id, prop_id, selection, result, actual_value, created_at, props(player_name, player_id, stat_category, line, game_id))";

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

export default async function CardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirectTo=/picks");
  }

  // Fetch locked and resolved cards separately for proper pagination
  const [activeCards, completedCards] = await Promise.all([
    getCardsByStatus(user.id, "locked"),
    getCardsByStatus(user.id, "resolved", PAGE_SIZE),
  ]);

  const avgScore =
    completedCards.length > 0
      ? (
          completedCards.reduce((sum, c) => sum + c.score, 0) /
          completedCards.length
        ).toFixed(1)
      : null;

  const bestScore =
    completedCards.length > 0
      ? Math.max(...completedCards.map((c) => c.score))
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
              <span className="text-2xl font-black">{avgScore}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Avg Score</span>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="flex flex-col items-center gap-1 p-4">
              <Trophy className="h-5 w-5 text-neon-green" />
              <span className="text-2xl font-black text-neon-green">{bestScore}/6</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Best</span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs for Live / Finished */}
      <Tabs defaultValue="live">
        <TabsList className="bg-secondary">
          <TabsTrigger value="live" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            Live ({activeCards.length})
          </TabsTrigger>
          <TabsTrigger value="finished" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            Finished ({completedCards.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-4">
          <LiveTracker initialCards={activeCards} />
        </TabsContent>

        <TabsContent value="finished" className="mt-4">
          {completedCards.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <span className="text-3xl">📊</span>
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

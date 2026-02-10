import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CardListWithLoadMore from "@/components/cards/CardListWithLoadMore";
import type { CardWithPicks } from "@/lib/cards/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Target, BarChart3, Trophy } from "lucide-react";

async function getCards(): Promise<CardWithPicks[]> {
  const supabase = await createClient();

  const result = await (supabase.from("cards") as any)
    .select("*, picks(*, props(player_name, player_id, stat_category, line, game_id))")
    .order("created_at", { ascending: false })
    .limit(20);

  return (result.data ?? []) as CardWithPicks[];
}

export default async function CardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirectTo=/cards");
  }

  const cards = await getCards();

  const activeCards = cards.filter((c) => c.status === "locked");
  const completedCards = cards.filter((c) => c.status === "resolved");

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
    <div className="flex flex-col gap-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">My Cards</h1>
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

      {/* Tabs for Active / Completed */}
      <Tabs defaultValue="active">
        <TabsList className="bg-secondary">
          <TabsTrigger value="active" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            Active ({activeCards.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            Completed ({completedCards.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          {activeCards.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <span className="text-3xl">🎯</span>
                <p className="text-muted-foreground">No active cards</p>
                <Link href="/props">
                  <Button variant="link" className="text-primary">Go make your picks!</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <CardListWithLoadMore
              initialCards={activeCards}
              statusFilter="locked"
              pageSize={20}
            />
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          {completedCards.length === 0 ? (
            <Card className="border-border bg-card">
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <span className="text-3xl">📊</span>
                <p className="text-muted-foreground">No completed cards yet</p>
              </CardContent>
            </Card>
          ) : (
            <CardListWithLoadMore
              initialCards={completedCards}
              statusFilter="resolved"
              pageSize={20}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

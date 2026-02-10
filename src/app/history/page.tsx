import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CardListWithLoadMore from "@/components/cards/CardListWithLoadMore";
import type { CardWithPicks } from "@/lib/cards/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 20;

async function getResolvedCards(limit: number = PAGE_SIZE): Promise<CardWithPicks[]> {
  const supabase = await createClient();

  const result = await (supabase.from("cards") as any)
    .select("*, picks(*, props(player_name, player_id, stat_category, line, game_id))")
    .eq("status", "resolved")
    .order("resolved_at", { ascending: false })
    .limit(limit);

  return (result.data ?? []) as CardWithPicks[];
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirectTo=/history");
  }

  const cards = await getResolvedCards();

  const totalResolved = cards.length;

  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Game History</h1>
          {totalResolved > 0 && (
            <p className="text-sm text-muted-foreground">
              {totalResolved} resolved card{totalResolved !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {/* Cards */}
      {cards.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center gap-4 py-20 text-center">
            <span className="text-4xl">&#x1F4DC;</span>
            <h2 className="text-xl font-semibold">No games played yet</h2>
            <p className="text-muted-foreground">
              Start by making your picks!
            </p>
            <Link href="/props">
              <Button variant="link" className="text-primary">
                Browse Props
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <CardListWithLoadMore
          initialCards={cards}
          statusFilter="resolved"
          pageSize={PAGE_SIZE}
        />
      )}
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CardDetail from "@/components/cards/CardDetail";
import type { CardWithPicks } from "@/lib/cards/api";

async function getResolvedCards(limit: number = 10): Promise<CardWithPicks[]> {
  const supabase = await createClient();

  const result = await (supabase.from("cards") as any)
    .select("*, picks(*, props(player_name, stat_category, line, game_id))")
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
          <h1 className="text-2xl font-bold">Game History</h1>
          {totalResolved > 0 && (
            <p className="text-sm text-muted">
              {totalResolved} resolved card{totalResolved !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {/* Cards */}
      {cards.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface py-20 text-center">
          <span className="text-4xl">📜</span>
          <h2 className="text-xl font-semibold">No games played yet</h2>
          <p className="text-muted">
            Start by making your picks!
          </p>
          <Link
            href="/props"
            className="text-sm text-indigo-400 hover:text-indigo-300"
          >
            Browse Props
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {cards.map((card) => (
            <CardDetail key={card.id} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}

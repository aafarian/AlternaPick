import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CardDetail from "@/components/cards/CardDetail";
import type { CardWithPicks } from "@/lib/cards/api";

async function getCards(): Promise<CardWithPicks[]> {
  const supabase = await createClient();

  const result = await (supabase.from("cards") as any)
    .select("*, picks(*, props(player_name, stat_category, line, game_id))")
    .order("created_at", { ascending: false })
    .limit(50);

  return (result.data ?? []) as CardWithPicks[];
}

export default async function CardsPage() {
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
        <h1 className="text-2xl font-bold">My Cards</h1>
        <Link
          href="/props"
          className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-600"
        >
          New Card
        </Link>
      </div>

      {/* Stats summary */}
      {completedCards.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-surface p-4 text-center">
            <div className="text-2xl font-bold">{completedCards.length}</div>
            <div className="text-xs text-muted">Completed</div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 text-center">
            <div className="text-2xl font-bold">{avgScore}</div>
            <div className="text-xs text-muted">Avg Score</div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 text-center">
            <div className="text-2xl font-bold text-green-400">
              {bestScore}/6
            </div>
            <div className="text-xs text-muted">Best</div>
          </div>
        </div>
      )}

      {/* Active cards */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Active Cards</h2>
        {activeCards.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface py-12 text-center">
            <span className="text-3xl">🎯</span>
            <p className="text-muted">No active cards</p>
            <Link
              href="/props"
              className="text-sm text-indigo-400 hover:text-indigo-300"
            >
              Go make your picks!
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {activeCards.map((card) => (
              <CardDetail key={card.id} card={card} />
            ))}
          </div>
        )}
      </section>

      {/* Completed cards */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Completed Cards</h2>
        {completedCards.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface py-12 text-center">
            <span className="text-3xl">📊</span>
            <p className="text-muted">No completed cards yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {completedCards.map((card) => (
              <CardDetail key={card.id} card={card} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

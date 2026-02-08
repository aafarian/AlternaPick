import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import type { StatCategory } from "@/lib/supabase/types";
import type { CardWithPicks } from "@/lib/cards/api";

// ---------------------------------------------------------------------------
// Data fetching (admin client bypasses RLS for public access)
// ---------------------------------------------------------------------------

interface SharedCardData {
  card: CardWithPicks;
  username: string;
}

async function getSharedCard(token: string): Promise<SharedCardData | null> {
  const admin = createAdminClient();

  // Fetch card by share_token
  const { data: card, error } = await (admin.from("cards") as any)
    .select("*, picks(*, props(player_name, stat_category, line, game_id))")
    .eq("share_token", token)
    .single();

  if (error || !card) return null;

  const typedCard = card as CardWithPicks;

  // Fetch username from profiles if user_id exists
  let username = "Anonymous";
  if (typedCard.user_id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("username, display_name")
      .eq("id", typedCard.user_id)
      .single();

    if (profile) {
      username = (profile as { username: string; display_name: string | null }).display_name
        ?? (profile as { username: string }).username;
    }
  }

  return { card: typedCard, username };
}

// ---------------------------------------------------------------------------
// Dynamic OG metadata
// ---------------------------------------------------------------------------

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const data = await getSharedCard(token);

  if (!data) {
    return { title: "SportsTower - Card Not Found" };
  }

  const { card, username } = data;
  const pickSummary = card.picks
    .slice(0, 3)
    .map((p) => {
      const player = p.props?.player_name ?? "Unknown";
      const sel = p.selection === "over" ? "Over" : "Under";
      return `${player} ${sel} ${p.props?.line ?? ""}`;
    })
    .join(", ");

  return {
    title: `SportsTower - ${username}'s Card: ${card.score}/${card.total_picks}`,
    description: `${username} went ${card.score}/${card.total_picks}. Picks: ${pickSummary}${card.picks.length > 3 ? "..." : ""}`,
    openGraph: {
      title: `SportsTower - ${username}'s Card: ${card.score}/${card.total_picks}`,
      description: `${username} went ${card.score}/${card.total_picks}. Check out this card on SportsTower!`,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `SportsTower - ${username}'s Card: ${card.score}/${card.total_picks}`,
      description: `${username} went ${card.score}/${card.total_picks}. Check out this card on SportsTower!`,
    },
  };
}

// ---------------------------------------------------------------------------
// Result icon helper
// ---------------------------------------------------------------------------

function ResultIcon({ result }: { result: string }) {
  switch (result) {
    case "hit":
      return <span className="text-green-400 text-lg">&#10003;</span>;
    case "miss":
      return <span className="text-red-400 text-lg">&#10007;</span>;
    default:
      return <span className="text-amber-400 text-lg">&#8987;</span>;
  }
}

// ---------------------------------------------------------------------------
// Page component (public -- no auth required)
// ---------------------------------------------------------------------------

export default async function ShareCardPage({ params }: PageProps) {
  const { token } = await params;
  const data = await getSharedCard(token);

  if (!data) {
    notFound();
  }

  const { card, username } = data;
  const date = new Date(card.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const isGoodScore = card.score >= card.total_picks / 2;
  const hits = card.picks.filter((p) => p.result === "hit").length;
  const misses = card.picks.filter((p) => p.result === "miss").length;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      {/* Branding */}
      <Link
        href="/"
        className="mb-8 text-2xl font-bold tracking-tight text-white"
      >
        SportsTower
      </Link>

      {/* Card container */}
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-xl">
        {/* Card header */}
        <div className="flex flex-col gap-2 border-b border-border px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-bold text-indigo-400">
                {username.charAt(0).toUpperCase()}
              </div>
              <span className="font-semibold text-white">{username}</span>
            </div>
            <span className="text-xs text-muted">{date}</span>
          </div>

          {/* Score */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">
              {card.status === "resolved" ? "Final Score" : "In Progress"}
            </span>
            <span
              className={`text-2xl font-bold ${
                card.status === "resolved"
                  ? isGoodScore
                    ? "text-green-400"
                    : "text-red-400"
                  : "text-amber-400"
              }`}
            >
              {card.score}/{card.total_picks}
            </span>
          </div>

          {/* Hit/miss summary */}
          {card.status === "resolved" && (
            <div className="flex gap-3 text-xs text-muted">
              <span className="text-green-400">{hits} hits</span>
              <span className="text-red-400">{misses} misses</span>
            </div>
          )}
        </div>

        {/* Picks list */}
        <div className="flex flex-col gap-1 p-2">
          {card.picks.map((pick) => {
            const statCat = (pick.props?.stat_category ?? "points") as StatCategory;
            return (
              <div
                key={pick.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-background/50 px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <ResultIcon result={pick.result} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-white">
                      {pick.props?.player_name ?? "Unknown"}
                    </span>
                    <span
                      className={`w-fit rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                        CATEGORY_COLORS[statCat] ?? ""
                      }`}
                    >
                      {CATEGORY_LABELS[statCat] ?? statCat}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-bold text-white">{pick.props?.line ?? "\u2014"}</span>
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${
                      pick.selection === "over"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    }`}
                  >
                    {pick.selection === "over" ? "Over" : "Under"}
                  </span>
                  {pick.actual_value !== null && (
                    <span className="text-xs text-muted">
                      ({pick.actual_value})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer CTA */}
        <div className="border-t border-border px-5 py-4 text-center">
          <p className="mb-2 text-xs text-muted">Think you can do better?</p>
          <Link
            href="/props"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-600"
          >
            Make Your Picks
          </Link>
        </div>
      </div>
    </div>
  );
}

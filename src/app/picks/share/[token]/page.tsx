import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/constants";
import type { StatCategory } from "@/lib/supabase/types";
import type { CardWithPicks } from "@/lib/cards/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import PlayerAvatar from "@/components/players/PlayerAvatar";

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
    .select("*, picks(*, props(player_name, player_id, stat_category, line, game_id, games(sport)))")
    .eq("share_token", token)
    .single();

  if (error || !card) return null;

  const typedCard = card as CardWithPicks;

  // Fetch username from profiles if user_id exists
  let username = "Anonymous";
  if (typedCard.user_id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("username")
      .eq("id", typedCard.user_id)
      .single();

    if (profile) {
      username = (profile as { username: string }).username;
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
    return { title: "AlternaPick - Card Not Found" };
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
    title: `AlternaPick - ${username}'s Card: ${card.score}/${card.total_picks}`,
    description: `${username} went ${card.score}/${card.total_picks}. Picks: ${pickSummary}${card.picks.length > 3 ? "..." : ""}`,
    openGraph: {
      title: `AlternaPick - ${username}'s Card: ${card.score}/${card.total_picks}`,
      description: `${username} went ${card.score}/${card.total_picks}. Check out this card on AlternaPick!`,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `AlternaPick - ${username}'s Card: ${card.score}/${card.total_picks}`,
      description: `${username} went ${card.score}/${card.total_picks}. Check out this card on AlternaPick!`,
    },
  };
}

// ---------------------------------------------------------------------------
// Result icon helper
// ---------------------------------------------------------------------------

function ResultIcon({ result }: { result: string }) {
  switch (result) {
    case "hit":
      return <CheckCircle2 className="h-4 w-4 text-neon-green" />;
    case "miss":
      return <XCircle className="h-4 w-4 text-bold-red" />;
    default:
      return <Clock className="h-4 w-4 text-amber-400" />;
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
        className="mb-8 text-2xl font-bold tracking-tight"
      >
        <span className="text-primary">Alterna</span>Pick
      </Link>

      {/* Card container */}
      <Card className="w-full max-w-md border-border bg-card shadow-xl">
        {/* Card header */}
        <CardContent className="flex flex-col gap-2 border-b border-border px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                  {username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="font-semibold">{username}</span>
            </div>
            <span className="text-xs text-muted-foreground">{date}</span>
          </div>

          {/* Score */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {card.status === "resolved" ? "Final Score" : "In Progress"}
            </span>
            <span
              className={cn(
                "text-2xl font-black tabular-nums",
                card.status === "resolved"
                  ? isGoodScore
                    ? "text-neon-green"
                    : "text-bold-red"
                  : "text-amber-400"
              )}
            >
              {card.score}/{card.total_picks}
            </span>
          </div>

          {/* Hit/miss summary */}
          {card.status === "resolved" && (
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="text-neon-green">{hits} hits</span>
              <span className="text-bold-red">{misses} misses</span>
            </div>
          )}
        </CardContent>

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
                  <PlayerAvatar
                    playerId={pick.props?.player_id ?? null}
                    playerName={pick.props?.player_name ?? "Unknown"}
                    sport={(pick.props as any)?.games?.sport}
                    size="sm"
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {pick.props?.player_name ?? "Unknown"}
                    </span>
                    <Badge
                      variant="secondary"
                      className={cn("w-fit text-[10px]", CATEGORY_COLORS[statCat] ?? "")}
                    >
                      {CATEGORY_LABELS[statCat] ?? statCat}
                    </Badge>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-bold tabular-nums">
                    {pick.props?.line ?? "\u2014"}
                  </span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs",
                      pick.selection === "over"
                        ? "bg-neon-green/15 text-neon-green"
                        : "bg-bold-red/15 text-bold-red"
                    )}
                  >
                    {pick.selection === "over" ? "Over" : "Under"}
                  </Badge>
                  {pick.actual_value !== null && (
                    <span className="text-xs text-muted-foreground">
                      ({pick.actual_value})
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer CTA */}
        <Separator />
        <div className="px-5 py-4 text-center">
          <p className="mb-2 text-xs text-muted-foreground">Think you can do better?</p>
          <Link href="/props">
            <Button size="sm">Make Your Picks</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

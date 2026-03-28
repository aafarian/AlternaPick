import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORY_LABELS, getSiteUrl } from "@/lib/constants";
import type { StatCategory } from "@/lib/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { CheckCircle2, XCircle, Clock, ArrowRight } from "lucide-react";

// ---------- Helpers ----------

interface CardData {
  id: string;
  user_id: string | null;
  status: string;
  score: number;
  total_picks: number;
  game_mode: string;
  picks: Array<{
    id: string;
    selection: string;
    result: string;
    actual_value: number | null;
    props: {
      player_name: string;
      stat_category: string;
      line: number;
    } | null;
  }>;
}

async function fetchCard(cardId: string): Promise<CardData | null> {
  const admin = createAdminClient();

  const { data, error } = await (admin.from("cards") as any)
    .select(
      "id, user_id, status, score, total_picks, game_mode, picks(id, selection, result, actual_value, props(player_name, player_team, player_position, stat_category, line))"
    )
    .eq("id", cardId)
    .single();

  if (error || !data) return null;
  return data as CardData;
}

async function fetchUsername(userId: string | null): Promise<string> {
  if (!userId) return "Anonymous";
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();

  if (!data) return "Anonymous";
  return (data as { username: string }).username;
}

// ---------- Metadata ----------

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}): Promise<Metadata> {
  const { id } = await searchParams;

  if (!id) {
    return { title: "Card Not Found - AlternaPick" };
  }

  const card = await fetchCard(id);

  if (!card) {
    return { title: "Card Not Found - AlternaPick" };
  }

  const username = await fetchUsername(card.user_id);
  const scoreText = `${card.score}/${card.total_picks}`;
  const title = `${username}'s AlternaPick Card - ${scoreText}`;
  const description =
    card.status === "resolved"
      ? `${username} went ${scoreText} on their picks! Check out the results on AlternaPick.`
      : `${username} locked in ${card.total_picks} picks on AlternaPick. Follow along live!`;

  const siteUrl = getSiteUrl();
  const ogImageUrl = `${siteUrl}/api/og/card?cardId=${id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `${siteUrl}/cards/share?id=${id}`,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${username}'s AlternaPick card`,
        },
      ],
      siteName: "AlternaPick",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

// ---------- Result Icon ----------

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

// ---------- Page Component ----------

export default async function CardSharePage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;

  if (!id) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <h1 className="text-xl font-bold">Card Not Found</h1>
        <p className="text-muted-foreground">This link may be invalid.</p>
        <Link href="/">
          <Button size="sm">Go Home</Button>
        </Link>
      </div>
    );
  }

  const card = await fetchCard(id);

  if (!card) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <h1 className="text-xl font-bold">Card Not Found</h1>
        <p className="text-muted-foreground">
          This card doesn&apos;t exist or has been deleted.
        </p>
        <Link href="/">
          <Button size="sm">Go Home</Button>
        </Link>
      </div>
    );
  }

  const username = await fetchUsername(card.user_id);
  const isGoodScore = card.score >= card.total_picks / 2;

  return (
    <div className="mx-auto max-w-lg py-8">
      <Card className="border-border bg-card">
        <CardHeader className="flex-row items-center justify-between space-y-0 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">{username}&apos;s Card</span>
            {card.status === "resolved" && (
              <Badge
                variant="secondary"
                className={
                  isGoodScore
                    ? "border-neon-green/30 bg-neon-green/15 text-neon-green"
                    : "border-bold-red/30 bg-bold-red/15 text-bold-red"
                }
              >
                {card.score}/{card.total_picks} Correct
              </Badge>
            )}
            {card.status === "locked" && (
              <Badge
                variant="secondary"
                className="border-amber-500/30 bg-amber-500/15 text-amber-400"
              >
                Locked
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-1 p-2">
          {card.picks.map((pick) => {
            const statCat = (pick.props?.stat_category ?? "points") as StatCategory;
            return (
              <div
                key={pick.id}
                className="flex flex-wrap items-center justify-between gap-1 rounded-lg bg-background/50 px-3 py-2.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <ResultIcon result={pick.result} />
                  <span className="truncate text-sm font-bold">
                    {pick.props?.player_name ?? "Unknown"}
                  </span>
                  <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">
                    {CATEGORY_LABELS[statCat] ?? statCat}
                  </Badge>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-black tabular-nums">
                    {pick.props?.line ?? "\u2014"}
                  </span>
                  <Badge
                    variant="secondary"
                    className={
                      pick.selection === "over"
                        ? "border-neon-green/30 bg-neon-green/15 text-neon-green"
                        : "border-bold-red/30 bg-bold-red/15 text-bold-red"
                    }
                  >
                    {pick.selection === "over" ? "Over" : "Under"}
                  </Badge>
                  {pick.actual_value !== null && (
                    <span className="text-xs text-muted-foreground">
                      Actual: {pick.actual_value}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>

        <CardFooter className="justify-center px-4 py-4">
          <Link href="/props">
            <Button size="sm">
              Make Your Own Picks
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}

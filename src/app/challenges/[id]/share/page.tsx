import type { Metadata } from "next";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowRight } from "lucide-react";

// ---------- Helpers ----------

function getSiteUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    "http://localhost:3000";
  return base.startsWith("http") ? base : `https://${base}`;
}

interface ChallengeData {
  id: string;
  challenger_id: string;
  opponent_id: string;
  status: string;
  game_mode: string | null;
  winner_id: string | null;
}

interface ProfileData {
  id: string;
  username: string;
  display_name: string | null;
}

interface CardData {
  user_id: string | null;
  score: number;
  total_picks: number;
  status: string;
}

async function fetchChallenge(challengeId: string): Promise<{
  challenge: ChallengeData;
  challengerName: string;
  opponentName: string;
  challengerCard: CardData | null;
  opponentCard: CardData | null;
} | null> {
  const admin = createAdminClient();

  const { data: challenge, error } = await (admin.from("challenges") as any)
    .select("id, challenger_id, opponent_id, status, game_mode, winner_id")
    .eq("id", challengeId)
    .single();

  if (error || !challenge) return null;

  const ch = challenge as ChallengeData;

  // Fetch profiles
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username, display_name")
    .in("id", [ch.challenger_id, ch.opponent_id]);

  const profileMap = new Map<string, ProfileData>();
  for (const p of (profiles ?? []) as ProfileData[]) {
    profileMap.set(p.id, p);
  }

  const challengerProfile = profileMap.get(ch.challenger_id);
  const opponentProfile = profileMap.get(ch.opponent_id);

  const challengerName =
    challengerProfile?.display_name ?? challengerProfile?.username ?? "Player 1";
  const opponentName =
    opponentProfile?.display_name ?? opponentProfile?.username ?? "Player 2";

  // Fetch cards
  const { data: cards } = await (admin.from("cards") as any)
    .select("user_id, score, total_picks, status")
    .eq("challenge_id", challengeId);

  const cardsList = (cards ?? []) as CardData[];
  const challengerCard =
    cardsList.find((c) => c.user_id === ch.challenger_id) ?? null;
  const opponentCard =
    cardsList.find((c) => c.user_id === ch.opponent_id) ?? null;

  return { challenge: ch, challengerName, opponentName, challengerCard, opponentCard };
}

// ---------- Metadata ----------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  const result = await fetchChallenge(id);

  if (!result) {
    return { title: "Challenge Not Found - AlternaPick" };
  }

  const { challenge, challengerName, opponentName, challengerCard, opponentCard } = result;

  let title: string;
  let description: string;

  if (challenge.status === "resolved") {
    const cScore = challengerCard
      ? `${challengerCard.score}/${challengerCard.total_picks}`
      : "--";
    const oScore = opponentCard
      ? `${opponentCard.score}/${opponentCard.total_picks}`
      : "--";

    if (challenge.winner_id === challenge.challenger_id) {
      title = `${challengerName} beat ${opponentName}!`;
    } else if (challenge.winner_id === challenge.opponent_id) {
      title = `${opponentName} beat ${challengerName}!`;
    } else {
      title = `${challengerName} vs ${opponentName} - Draw!`;
    }

    description = `Final score: ${challengerName} ${cScore} vs ${opponentName} ${oScore}. Challenge your friends on AlternaPick!`;
  } else {
    title = `${challengerName} vs ${opponentName} - AlternaPick Challenge`;
    description = `${challengerName} challenged ${opponentName} on AlternaPick! Who will win?`;
  }

  const siteUrl = getSiteUrl();
  const ogImageUrl = `${siteUrl}/api/og/challenge?challengeId=${id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `${siteUrl}/challenges/${id}/share`,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${challengerName} vs ${opponentName} challenge`,
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

// ---------- Page Component ----------

function PlayerSide({
  name,
  score,
  isWinner,
}: {
  name: string;
  score: string;
  isWinner: boolean;
}) {
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="flex flex-1 flex-col items-center gap-3">
      <Avatar
        className={
          isWinner
            ? "h-16 w-16 ring-2 ring-neon-green"
            : "h-16 w-16"
        }
      >
        <AvatarFallback
          className={
            isWinner
              ? "bg-neon-green/20 text-neon-green text-xl font-bold"
              : "bg-primary/10 text-primary text-xl font-bold"
          }
        >
          {initial}
        </AvatarFallback>
      </Avatar>
      <span className="text-sm font-semibold">{name}</span>
      <span className="text-3xl font-black tabular-nums">{score}</span>
      {isWinner && (
        <Badge
          variant="secondary"
          className="border-neon-green/30 bg-neon-green/15 text-neon-green"
        >
          Winner
        </Badge>
      )}
    </div>
  );
}

export default async function ChallengeSharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await fetchChallenge(id);

  if (!result) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <h1 className="text-xl font-bold">Challenge Not Found</h1>
        <p className="text-muted-foreground">
          This challenge doesn&apos;t exist or has been deleted.
        </p>
        <Link href="/">
          <Button size="sm">Go Home</Button>
        </Link>
      </div>
    );
  }

  const { challenge, challengerName, opponentName, challengerCard, opponentCard } = result;

  const challengerScore = challengerCard
    ? `${challengerCard.score}/${challengerCard.total_picks}`
    : "--";
  const opponentScore = opponentCard
    ? `${opponentCard.score}/${opponentCard.total_picks}`
    : "--";

  const isResolved = challenge.status === "resolved";
  const challengerWon = isResolved && challenge.winner_id === challenge.challenger_id;
  const opponentWon = isResolved && challenge.winner_id === challenge.opponent_id;
  const isDraw = isResolved && !challenge.winner_id;

  let statusText = "In Progress";
  if (isResolved) {
    if (isDraw) statusText = "Draw";
    else if (challengerWon) statusText = `${challengerName} Wins!`;
    else statusText = `${opponentName} Wins!`;
  } else if (challenge.status === "pending") {
    statusText = "Pending";
  } else if (challenge.status === "active") {
    statusText = "Active";
  }

  return (
    <div className="mx-auto max-w-lg py-8">
      <Card className="border-border bg-card">
        <CardContent className="p-6">
          {/* Title */}
          <h1 className="mb-6 text-center text-lg font-bold">
            Challenge Matchup
          </h1>

          {/* Players */}
          <div className="flex items-start gap-4">
            <PlayerSide
              name={challengerName}
              score={challengerScore}
              isWinner={challengerWon}
            />

            <div className="flex shrink-0 items-center self-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                VS
              </div>
            </div>

            <PlayerSide
              name={opponentName}
              score={opponentScore}
              isWinner={opponentWon}
            />
          </div>

          {/* Status */}
          <div className="mt-6 flex justify-center">
            <Badge
              variant="secondary"
              className={
                isResolved
                  ? isDraw
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-neon-green/15 text-neon-green"
                  : "bg-muted/15 text-muted-foreground"
              }
            >
              {statusText}
            </Badge>
          </div>
        </CardContent>

        <CardFooter className="justify-center px-4 py-4">
          <Link href="/challenges">
            <Button size="sm">
              Challenge Your Friends
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}

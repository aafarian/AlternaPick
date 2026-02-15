"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/auth/auth-context";
import { createCard } from "@/lib/cards/api";
import { CATEGORY_LABELS, CATEGORY_COLORS, getPlayerHeadshotUrl, teamLogoUrl } from "@/lib/constants";
import type { StatCategory, Game, Prop, PickSelection } from "@/lib/supabase/types";
import type { ChallengeDetail } from "@/lib/challenges/queries";
import GameModeBadge from "@/components/challenges/GameModeBadge";
import type { GameMode } from "@/lib/modes/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ArrowLeft, AlertCircle, Lock, Clock } from "lucide-react";

const LOCK_BUFFER_MS = 5 * 60 * 1000;

type PropWithGame = Prop & { games: Game };

interface BallotPick {
  prop_id: string;
  selection: PickSelection;
}

function getInitials(name: string): string {
  const parts = name.split(" ");
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function PlayerHeadshot({
  playerId,
  playerName,
  sport,
}: {
  playerId: string | null;
  playerName: string;
  sport?: string;
}) {
  const [imgError, setImgError] = useState(false);

  if (!playerId || imgError) {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
        {getInitials(playerName)}
      </div>
    );
  }

  return (
    <div className="relative h-[80px] w-[100px]">
      <Image
        src={getPlayerHeadshotUrl(playerId, sport)}
        alt={playerName}
        width={100}
        height={80}
        className="object-contain object-bottom drop-shadow-lg"
        onError={() => setImgError(true)}
      />
    </div>
  );
}

export default function BallotPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const challengeId = params.id as string;

  const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);
  const [props, setProps] = useState<PropWithGame[]>([]);
  const [picks, setPicks] = useState<Map<string, PickSelection>>(new Map());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch challenge details
      const challengeRes = await fetch(`/api/challenges/${challengeId}`);
      if (!challengeRes.ok) throw new Error("Failed to load challenge");
      const challengeData = await challengeRes.json();
      const ch = challengeData.challenge as ChallengeDetail;
      setChallenge(ch);

      if (!ch.mirror_props || ch.mirror_props.length === 0) {
        throw new Error("This challenge has no ballot props");
      }

      // Fetch the full prop data for mirror_props
      const propsRes = await fetch(
        `/api/props/by-ids?ids=${ch.mirror_props.join(",")}`
      );
      if (!propsRes.ok) throw new Error("Failed to load prop details");
      const propsData = await propsRes.json();
      setProps(propsData.props ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load ballot");
    } finally {
      setLoading(false);
    }
  }, [challengeId]);

  useEffect(() => {
    if (!authLoading && user) fetchData();
  }, [authLoading, user, fetchData]);

  const now = Date.now();

  // Separate valid vs expired props
  const validProps = props.filter(
    (p) => new Date(p.games.commence_time).getTime() - now > LOCK_BUFFER_MS
  );
  const expiredProps = props.filter(
    (p) => new Date(p.games.commence_time).getTime() - now <= LOCK_BUFFER_MS
  );

  const allExpired = props.length > 0 && validProps.length === 0;
  const someExpired = expiredProps.length > 0 && validProps.length > 0;

  // Count picks for valid props only
  const validPicks = validProps.filter((p) => picks.has(p.id));
  const allPicked = validProps.length > 0 && validPicks.length === validProps.length;

  function togglePick(propId: string, selection: PickSelection) {
    setPicks((prev) => {
      const next = new Map(prev);
      if (next.get(propId) === selection) {
        next.delete(propId);
      } else {
        next.set(propId, selection);
      }
      return next;
    });
  }

  async function handleLock() {
    if (!challenge || !allPicked) return;
    setSubmitting(true);
    setError(null);
    try {
      const picksList: BallotPick[] = validProps.map((p) => ({
        prop_id: p.id,
        selection: picks.get(p.id)!,
      }));

      await createCard(
        picksList,
        undefined,
        challengeId,
        challenge.game_mode,
        validProps.length
      );

      router.push(`/challenges/${challengeId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to lock card");
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex flex-col gap-6 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-64" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (!user) {
    router.push("/auth/login");
    return null;
  }

  if (!challenge) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="text-muted-foreground">Challenge not found</p>
        <Link href="/challenges">
          <Button variant="outline" size="sm">
            Back to Challenges
          </Button>
        </Link>
      </div>
    );
  }

  const challengerName =
    challenge.challenger.display_name || challenge.challenger.username;

  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Back link */}
      <Link
        href={`/challenges/${challengeId}`}
        className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Challenge
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Make Your Picks
          </h1>
          {challenge.game_mode && (
            <GameModeBadge
              mode={challenge.game_mode as GameMode}
              size="lg"
              showClassic
            />
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {challenge.game_mode === "random"
            ? "The system selected these props. Call over or under on each line."
            : `${challengerName} selected these props. Call over or under on each line.`}
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {validProps.map((p, i) => (
            <div
              key={p.id}
              className={cn(
                "h-2 w-6 rounded-full transition-colors",
                picks.has(p.id) ? "bg-primary" : "bg-secondary"
              )}
            />
          ))}
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {validPicks.length}/{validProps.length}
        </span>
      </div>

      {/* Warnings */}
      {allExpired && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            All props on this challenge have expired. The challenge has been
            cancelled.
          </AlertDescription>
        </Alert>
      )}

      {someExpired && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertDescription>
            {expiredProps.length} prop(s) have expired and are disabled. Your
            card will include the {validProps.length} remaining prop(s).
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button
              variant="link"
              size="sm"
              onClick={() => setError(null)}
              className="ml-2 text-destructive underline"
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Ballot cards */}
      <div className="flex flex-col gap-4">
        {props.map((prop) => {
          const isExpired =
            new Date(prop.games.commence_time).getTime() - now <=
            LOCK_BUFFER_MS;
          const selection = picks.get(prop.id);
          const catLabel =
            CATEGORY_LABELS[prop.stat_category as StatCategory] ??
            prop.stat_category;
          const catColor =
            CATEGORY_COLORS[prop.stat_category as StatCategory] ?? "";
          const bgLogoUrl = teamLogoUrl(prop.player_team ?? prop.games.home_team);

          return (
            <div
              key={prop.id}
              className={cn(
                "relative overflow-hidden rounded-2xl border border-border bg-card transition-all",
                isExpired
                  ? "opacity-50"
                  : selection
                    ? "border-primary/40 shadow-[0_0_24px_rgba(0,210,106,0.15)]"
                    : "hover:border-border/80"
              )}
            >
              {/* Expired badge */}
              {isExpired && (
                <div className="absolute right-3 top-3 z-20">
                  <Badge variant="destructive" className="text-xs">
                    Started
                  </Badge>
                </div>
              )}

              {/* Player section */}
              <div className="relative flex flex-col items-center px-4 pt-4 pb-2">
                {/* Team logo watermark */}
                {bgLogoUrl && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={bgLogoUrl}
                      alt=""
                      className="h-32 w-32 object-contain opacity-[0.14]"
                    />
                  </div>
                )}

                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div
                    className={cn(
                      "h-20 w-20 rounded-full opacity-30 blur-2xl",
                      selection ? "bg-primary" : "bg-muted-foreground/30"
                    )}
                  />
                </div>

                <PlayerHeadshot
                  playerId={prop.player_id}
                  playerName={prop.player_name}
                  sport={prop.games.sport}
                />

                <span className="relative z-10 mt-1 text-center text-sm font-bold leading-tight">
                  {prop.player_name}
                </span>

                {prop.player_team && (
                  <span className="relative z-10 mt-0.5 text-[11px] font-medium text-muted-foreground">
                    {prop.player_team}
                    {prop.player_position ? ` - ${prop.player_position}` : ""}
                  </span>
                )}

                <span className="relative z-10 mt-1 text-[10px] text-muted-foreground">
                  {prop.games.away_team} @ {prop.games.home_team}
                </span>
              </div>

              {/* Line + stat */}
              <div className="flex flex-col items-center gap-0.5 pb-2">
                <div className="flex items-baseline justify-center gap-1.5">
                  <span className="text-3xl font-black tabular-nums tracking-tight">
                    {prop.line}
                  </span>
                  <Badge variant="secondary" className={cn("text-[10px]", catColor)}>
                    {catLabel}
                  </Badge>
                </div>
              </div>

              {/* Over / Under */}
              <div className="grid grid-cols-2 gap-px border-t border-border">
                <button
                  onClick={() => !isExpired && togglePick(prop.id, "over")}
                  disabled={isExpired}
                  className={cn(
                    "py-3.5 text-sm font-bold uppercase tracking-wider transition-all",
                    isExpired
                      ? "cursor-not-allowed text-muted-foreground/30"
                      : selection === "over"
                        ? "bg-neon-green/15 text-neon-green"
                        : "text-muted-foreground hover:bg-neon-green/5 hover:text-neon-green"
                  )}
                >
                  Over
                </button>
                <button
                  onClick={() => !isExpired && togglePick(prop.id, "under")}
                  disabled={isExpired}
                  className={cn(
                    "border-l border-border py-3.5 text-sm font-bold uppercase tracking-wider transition-all",
                    isExpired
                      ? "cursor-not-allowed text-muted-foreground/30"
                      : selection === "under"
                        ? "bg-bold-red/15 text-bold-red"
                        : "text-muted-foreground hover:bg-bold-red/5 hover:text-bold-red"
                  )}
                >
                  Under
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lock Card button */}
      {!allExpired && (
        <div className="sticky bottom-4 z-30">
          <Button
            onClick={handleLock}
            disabled={!allPicked || submitting}
            className="w-full gap-2 py-6 text-base font-bold"
            size="lg"
          >
            <Lock className="h-4 w-4" />
            {submitting
              ? "Locking..."
              : allPicked
                ? "Lock Card"
                : `Pick ${validProps.length - validPicks.length} more`}
          </Button>
        </div>
      )}
    </div>
  );
}

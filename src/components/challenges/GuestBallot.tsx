"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { CATEGORY_LABELS, CATEGORY_COLORS, teamLogoUrl } from "@/lib/constants";
import { getPlayerHeadshotUrl, getHeadshotConfig } from "@/lib/sports";
import type { StatCategory, PickSelection } from "@/lib/supabase/types";
import type { GameMode } from "@/lib/modes/types";
import GameModeBadge from "@/components/challenges/GameModeBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format/name-utils";
import { AlertCircle, Lock, Clock, Loader2, CheckCircle2 } from "lucide-react";

const LOCK_BUFFER_MS = 5 * 60 * 1000;

interface GuestProp {
  id: string;
  player_name: string;
  player_id: string | null;
  player_team: string | null;
  player_position: string | null;
  stat_category: StatCategory;
  line: number;
  commence_time: string;
  sport: string;
  home_team: string;
}

interface GuestBallotProps {
  challengeId: string;
  token: string;
  challengerName: string;
  gameMode: GameMode;
  message: string | null;
  props: GuestProp[];
}

/** Matches PlayerHeadshot from ballot page */
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
      <div className="flex h-[100px] w-[130px] items-end justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
          {getInitials(playerName)}
        </div>
      </div>
    );
  }

  const hs = getHeadshotConfig(sport);

  return (
    <div className="relative h-[100px] w-[130px]">
      <Image
        src={getPlayerHeadshotUrl(playerId, sport)}
        alt={playerName}
        width={hs.width}
        height={hs.height}
        unoptimized={hs.isProxied}
        className={cn(
          "relative z-10 object-contain drop-shadow-lg",
          hs.isProxied ? "mx-auto object-bottom" : "object-bottom"
        )}
        onError={() => setImgError(true)}
      />
    </div>
  );
}

export default function GuestBallot({
  challengeId,
  token,
  challengerName,
  gameMode,
  message,
  props,
}: GuestBallotProps) {
  const [picks, setPicks] = useState<Map<string, PickSelection>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Keep `now` fresh so expired props are disabled in real-time
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  // Separate valid vs expired props
  const validProps = props.filter(
    (p) => new Date(p.commence_time).getTime() - now > LOCK_BUFFER_MS
  );
  const expiredProps = props.filter(
    (p) => new Date(p.commence_time).getTime() - now <= LOCK_BUFFER_MS
  );

  const allExpired = props.length > 0 && validProps.length === 0;
  const someExpired = expiredProps.length > 0 && validProps.length > 0;

  // Count picks for valid props only
  const validPicks = validProps.filter((p) => picks.has(p.id));
  const allPicked =
    validProps.length > 0 && validPicks.length === validProps.length;

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
    if (!allPicked) return;
    setSubmitting(true);
    setError(null);
    try {
      const picksList = validProps.map((p) => ({
        prop_id: p.id,
        selection: picks.get(p.id)!,
      }));

      const res = await fetch(`/api/challenges/${challengeId}/guest-pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, picks: picksList }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error ?? `Failed to submit picks: ${res.status}`
        );
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to lock card");
    } finally {
      setSubmitting(false);
    }
  }

  // Success state after submission
  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="mx-auto flex max-w-md flex-col items-center gap-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-bold tracking-tight">
              Your Picks Are Locked In!
            </h1>
            <p className="text-sm text-muted-foreground">
              You went head-to-head with {challengerName}. Sign up to track your
              results and see who wins.
            </p>
          </div>
          <Link href="/auth/signup">
            <Button size="lg" className="font-bold">
              Sign Up to Track Results
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Make Your Picks
            </h1>
            <GameModeBadge
              mode={gameMode}
              size="lg"
              showClassic
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {gameMode === "random"
              ? "The system selected these props. Call over or under on each line."
              : `${challengerName} selected these props. Call over or under on each line.`}
          </p>
        </div>

        {/* Trash talk message */}
        {message && (
          <div className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              {challengerName} says:
            </p>
            <p className="mt-1 text-sm font-medium italic">&ldquo;{message}&rdquo;</p>
          </div>
        )}

        {/* Progress */}
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {validProps.map((p) => (
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

        {/* Ballot cards — matches PropLine rendering from ballot page */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {props.map((prop) => {
            const isExpired =
              new Date(prop.commence_time).getTime() - now <= LOCK_BUFFER_MS;
            const selection = picks.get(prop.id);
            const statCategory = prop.stat_category;
            const bgLogoUrl = teamLogoUrl(
              prop.player_team ?? prop.home_team
            );

            return (
              <div
                key={prop.id}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all",
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

                {/* Center: player headshot with team logo background */}
                <div className="relative flex flex-col items-center px-4 pt-4 pb-2">
                  {/* Team logo watermark behind player */}
                  {bgLogoUrl && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={bgLogoUrl}
                        alt=""
                        className="h-40 w-40 object-contain opacity-[0.14]"
                      />
                    </div>
                  )}

                  {/* Radial glow behind player */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div
                      className={cn(
                        "h-24 w-24 rounded-full opacity-30 blur-2xl",
                        selection ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                    />
                  </div>

                  <PlayerHeadshot
                    playerId={prop.player_id}
                    playerName={prop.player_name}
                    sport={prop.sport}
                  />

                  {/* Player name */}
                  <span className="relative z-10 mt-1 truncate text-center text-sm font-bold leading-tight">
                    {prop.player_name}
                  </span>

                  {/* Team abbreviation + position */}
                  {prop.player_team && (
                    <span className="relative z-10 mt-0.5 text-[11px] font-medium text-muted-foreground">
                      {prop.player_team}
                      {prop.player_position
                        ? ` - ${prop.player_position}`
                        : ""}
                    </span>
                  )}
                </div>

                {/* Line number + stat category */}
                <div className="flex flex-col items-center gap-0.5 pb-2">
                  <div className="flex items-baseline justify-center gap-1.5">
                    <span className="text-3xl font-black tabular-nums tracking-tight">
                      {prop.line}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-bold uppercase",
                        CATEGORY_COLORS[statCategory]?.replace(
                          /bg-\S+\s*/,
                          ""
                        )
                      )}
                    >
                      {CATEGORY_LABELS[statCategory]}
                    </span>
                  </div>
                </div>

                {/* Over / Under buttons */}
                <div className="mt-auto grid grid-cols-2 gap-px border-t border-border">
                  <button
                    onClick={() => !isExpired && togglePick(prop.id, "over")}
                    disabled={isExpired}
                    aria-label={`Pick over ${prop.line} ${CATEGORY_LABELS[statCategory]} for ${prop.player_name}`}
                    className={cn(
                      "cursor-pointer py-3 text-xs font-bold uppercase tracking-wider transition-all",
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
                    aria-label={`Pick under ${prop.line} ${CATEGORY_LABELS[statCategory]} for ${prop.player_name}`}
                    className={cn(
                      "cursor-pointer border-l border-border py-3 text-xs font-bold uppercase tracking-wider transition-all",
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
          <div className="sticky bottom-4 z-30 mx-auto w-full max-w-md">
            <Button
              onClick={handleLock}
              disabled={!allPicked || submitting}
              className="w-full gap-2 py-6 text-base font-bold"
              size="lg"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              {submitting
                ? "Locking..."
                : allPicked
                  ? "Lock Card"
                  : `Pick ${validProps.length - validPicks.length} more`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

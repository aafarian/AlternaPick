"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  Trophy,
  Swords,
  CalendarDays,
  CheckCircle,
} from "lucide-react";
import type {
  AdminChallengeDetail,
  AdminChallengePlayerSide,
  AdminCardPickDetail,
} from "@/lib/admin/types";
import {
  formatDate,
  formatDateTime,
  challengeStatusVariant,
  cardStatusVariant,
  gameModeLabel,
  statCategoryLabel,
  pickResultClasses,
} from "@/lib/admin/helpers";

// ---------------------------------------------------------------------------
// Skeleton components
// ---------------------------------------------------------------------------

function HeaderSkeleton() {
  return (
    <Card className="py-5">
      <CardContent className="px-6 pb-0 pt-0">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PlayerSideSkeleton() {
  return (
    <Card className="py-5">
      <CardHeader className="pb-0 pt-0 px-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-0 pt-0">
        <div className="space-y-2 mt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlayerSideSkeleton />
        <PlayerSideSkeleton />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-sections
// ---------------------------------------------------------------------------

function ChallengeHeader({
  challenge,
}: {
  challenge: AdminChallengeDetail;
}) {
  return (
    <Card className="py-5">
      <CardContent className="px-6 pb-0 pt-0">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Swords className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-bold tracking-tight">
              Challenge Detail
            </h2>
            <Badge variant={challengeStatusVariant(challenge.status)}>
              {challenge.status}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              Game Mode:{" "}
              <span className="text-foreground font-medium">
                {gameModeLabel(challenge.gameMode)}
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Created: {formatDateTime(challenge.createdAt)}
            </span>
            {challenge.resolvedAt && (
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5" />
                Resolved: {formatDateTime(challenge.resolvedAt)}
              </span>
            )}
            <span>
              Card Size:{" "}
              <span className="text-foreground font-medium">
                {challenge.cardSize}
              </span>
            </span>
          </div>

          {challenge.message && (
            <p className="text-sm italic text-muted-foreground">
              &ldquo;{challenge.message}&rdquo;
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PicksTable({ picks }: { picks: AdminCardPickDetail[] }) {
  if (picks.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No picks
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Player</TableHead>
          <TableHead>Stat</TableHead>
          <TableHead className="text-right">Line</TableHead>
          <TableHead>Pick</TableHead>
          <TableHead>Result</TableHead>
          <TableHead className="text-right">Actual</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {picks.map((pick) => (
          <TableRow key={pick.id}>
            <TableCell className="font-medium max-w-[140px] truncate">
              {pick.playerName}
            </TableCell>
            <TableCell>{statCategoryLabel(pick.statCategory)}</TableCell>
            <TableCell className="text-right">{pick.line}</TableCell>
            <TableCell className="uppercase text-xs font-medium">
              {pick.selection}
            </TableCell>
            <TableCell>
              <Badge
                variant="secondary"
                className={pickResultClasses(pick.result)}
              >
                {pick.result}
              </Badge>
            </TableCell>
            <TableCell className="text-right font-medium">
              {pick.actualValue !== null ? pick.actualValue : "\u2014"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function PlayerSide({
  side,
  isWinner,
  label,
}: {
  side: AdminChallengePlayerSide;
  isWinner: boolean;
  label: string;
}) {
  return (
    <Card
      className={`py-5 ${isWinner ? "ring-2 ring-amber-500/50 dark:ring-amber-400/40" : ""}`}
    >
      <CardHeader className="pb-0 pt-0 px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              {side.avatarUrl && (
                <AvatarImage src={side.avatarUrl} alt={side.username} />
              )}
              <AvatarFallback className="text-sm">
                {side.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div>
              <Link
                href={`/admin/users/${side.userId}`}
                className="text-sm font-semibold text-primary hover:underline"
              >
                {side.displayName ?? side.username}
              </Link>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>

          {isWinner && (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <Trophy className="h-4 w-4" />
              <span className="text-xs font-semibold">Winner</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-0 pt-0 mt-4">
        {side.card ? (
          <div className="space-y-3">
            {/* Card status and score */}
            <div className="flex items-center gap-3 text-sm">
              <Badge variant={cardStatusVariant(side.card.status)}>
                {side.card.status}
              </Badge>
              <span className="font-medium">
                Score: {side.card.score}/{side.card.totalPicks}
              </span>
              {side.card.lockedAt && (
                <span className="text-xs text-muted-foreground">
                  Locked {formatDate(side.card.lockedAt)}
                </span>
              )}
            </div>

            {/* Picks table */}
            <PicksTable picks={side.card.picks} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No card submitted
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ChallengeDetail({
  challengeId,
}: {
  challengeId: string;
}) {
  const [detail, setDetail] = useState<AdminChallengeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/challenges/${challengeId}`);
      if (res.status === 404) {
        throw new Error("Challenge not found");
      }
      if (!res.ok) {
        throw new Error(`Failed to load challenge detail (${res.status})`);
      }
      const data: AdminChallengeDetail = await res.json();
      setDetail(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  }, [challengeId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Back link (always visible)
  const backLink = (
    <Link
      href="/admin/lookup"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to Lookup
    </Link>
  );

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        {backLink}
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card p-12 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">{error}</p>
          </div>
          <Button variant="outline" onClick={fetchDetail} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading || !detail) {
    return (
      <div className="space-y-6">
        {backLink}
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      {backLink}

      {/* Challenge metadata header */}
      <ChallengeHeader challenge={detail} />

      {/* Side-by-side player comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlayerSide
          side={detail.challenger}
          isWinner={detail.winnerId === detail.challenger.userId}
          label="Challenger"
        />
        <PlayerSide
          side={detail.opponent}
          isWinner={detail.winnerId === detail.opponent.userId}
          label="Opponent"
        />
      </div>
    </div>
  );
}

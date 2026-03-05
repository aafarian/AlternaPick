"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  Loader2,
  User,
  Swords,
  Layers,
  Crosshair,
  Clock,
  Lock,
  CheckCircle2,
} from "lucide-react";
import type { AdminCardDetail, AdminCardPickDetail } from "@/lib/admin/types";
import type { ChallengeStatus } from "@/lib/supabase/types";
import {
  formatDateTime,
  cardStatusVariant,
  gameModeLabel,
  statCategoryLabel,
  pickResultClasses,
} from "@/lib/admin/helpers";

// ---------------------------------------------------------------------------
// API response shape (extends AdminCardDetail with challenge info)
// ---------------------------------------------------------------------------

interface CardDetailResponse extends AdminCardDetail {
  challenge: {
    id: string;
    status: ChallengeStatus;
    opponentId: string;
  } | null;
}

// ---------------------------------------------------------------------------
// Skeleton components
// ---------------------------------------------------------------------------

function HeaderSkeleton() {
  return (
    <Card className="py-5">
      <CardContent className="px-6 pb-0 pt-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="py-4">
            <CardHeader className="pb-0 pt-0 px-4 gap-1">
              <Skeleton className="h-3.5 w-20" />
            </CardHeader>
            <CardContent className="px-4 pt-1 pb-0">
              <Skeleton className="h-7 w-14" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <TableSkeleton />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-sections
// ---------------------------------------------------------------------------

function ResyncButton({
  cardId,
  onComplete,
}: {
  cardId: string;
  onComplete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/fix-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `Failed (${res.status})`);
      }
      if (data.resolved) {
        toast.success(`Card resolved: ${data.score}/${data.total}`);
      } else {
        toast.info(`${data.gamesUpdated} game(s) updated. Card not yet resolvable. Check console for debug info.`);
      }
      setOpen(false);
      onComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  }, [cardId, onComplete]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <RefreshCw className="h-4 w-4" />
          Re-sync Games
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Re-sync game data?</AlertDialogTitle>
          <AlertDialogDescription>
            This will re-fetch game data from the stats service and re-attempt
            resolution if all games are final.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <Button onClick={handleConfirm} disabled={loading} className="gap-1.5">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Re-sync
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CardHeaderSection({ data, onResync }: { data: CardDetailResponse; onResync: () => void }) {
  return (
    <Card className="py-5">
      <CardContent className="px-6 pb-0 pt-0">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Left: owner info */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight">
                Card Detail
              </h2>
              <Badge variant={cardStatusVariant(data.status)}>
                {data.status}
              </Badge>
            </div>

            {data.userId && data.username ? (
              <div className="flex items-center gap-1.5 text-sm">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Owner:</span>
                <Link
                  href={`/admin/users/${data.userId}`}
                  className="text-primary hover:underline font-medium"
                >
                  {data.displayName ?? data.username}
                </Link>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No owner</p>
            )}

            {data.challenge && (
              <div className="flex items-center gap-1.5 text-sm">
                <Swords className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Challenge:</span>
                <Link
                  href={`/admin/lookup/challenge/${data.challenge.id}`}
                  className="text-primary hover:underline font-medium"
                >
                  {data.challenge.id.slice(0, 8)}...
                </Link>
                <Badge variant="secondary" className="text-[10px] ml-1">
                  {data.challenge.status}
                </Badge>
              </div>
            )}
          </div>

          {/* Right: meta badges + actions */}
          <div className="flex flex-wrap items-center gap-2">
            {data.status === "locked" && (
              <ResyncButton cardId={data.id} onComplete={onResync} />
            )}
            <Badge variant="outline">{gameModeLabel(data.gameMode)}</Badge>
            <Badge variant="outline">{data.cardSize}-pick</Badge>
            <Badge variant="outline">
              Score: {data.score}/{data.totalPicks}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TimestampsGrid({ data }: { data: CardDetailResponse }) {
  const timestamps = [
    { label: "Created", icon: Clock, value: data.createdAt },
    { label: "Locked", icon: Lock, value: data.lockedAt },
    { label: "Resolved", icon: CheckCircle2, value: data.resolvedAt },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {timestamps.map((ts) => {
        const Icon = ts.icon;
        return (
          <Card key={ts.label} className="py-4">
            <CardHeader className="pb-0 pt-0 px-4 gap-1">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {ts.label}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pt-1 pb-0">
              <p className="text-sm font-medium">
                {formatDateTime(ts.value)}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function PicksTable({ picks }: { picks: AdminCardPickDetail[] }) {
  if (picks.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No picks on this card
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
          <TableHead>Selection</TableHead>
          <TableHead>Result</TableHead>
          <TableHead className="text-right">Actual</TableHead>
          <TableHead>Matchup</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {picks.map((pick) => (
          <TableRow key={pick.id}>
            <TableCell className="font-medium">
              <div>
                {pick.playerName}
                {pick.playerTeam && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {pick.playerTeam}
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell>{statCategoryLabel(pick.statCategory)}</TableCell>
            <TableCell className="text-right font-mono">
              {pick.line}
            </TableCell>
            <TableCell>
              <Badge variant="secondary" className="uppercase text-[10px]">
                {pick.selection}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge className={pickResultClasses(pick.result)}>
                {pick.result}
              </Badge>
            </TableCell>
            <TableCell className="text-right font-mono">
              {pick.actualValue !== null ? pick.actualValue : "\u2014"}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {pick.awayTeam} @ {pick.homeTeam}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CardDetail({ cardId }: { cardId: string }) {
  const [data, setData] = useState<CardDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/cards/${cardId}`);
      if (res.status === 404) {
        throw new Error("Card not found");
      }
      if (!res.ok) {
        throw new Error(`Failed to load card detail (${res.status})`);
      }
      const json: CardDetailResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  }, [cardId]);

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
  if (loading || !data) {
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

      {/* Header with status, owner, challenge info, meta badges */}
      <CardHeaderSection data={data} onResync={fetchDetail} />

      {/* Timestamps */}
      <TimestampsGrid data={data} />

      {/* Picks table */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Crosshair className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">
            Picks ({data.picks.length}/{data.cardSize})
          </h3>
        </div>
        <Card className="py-0 overflow-hidden">
          <CardContent className="px-0 py-0">
            <PicksTable picks={data.picks} />
          </CardContent>
        </Card>
      </div>

      {/* Card ID footer */}
      <div className="flex items-center gap-2">
        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground font-mono">
          {data.id}
        </p>
      </div>
    </div>
  );
}

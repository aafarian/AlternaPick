"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  User,
  Layers,
  Swords,
  Crosshair,
  AlertCircle,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import type { AdminLookupResult } from "@/lib/admin/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const TYPE_CONFIG: Record<
  AdminLookupResult["type"],
  { label: string; icon: React.ElementType; color: string }
> = {
  profile: {
    label: "Profile",
    icon: User,
    color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
  card: {
    label: "Card",
    icon: Layers,
    color: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  },
  challenge: {
    label: "Challenge",
    icon: Swords,
    color: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  },
  pick: {
    label: "Pick",
    icon: Crosshair,
    color: "bg-teal-500/15 text-teal-700 dark:text-teal-400",
  },
};

// ---------------------------------------------------------------------------
// Result renderers
// ---------------------------------------------------------------------------

function ProfileResult({ data }: { data: Record<string, unknown> }) {
  const username = data.username as string;
  const displayName = data.displayName as string | null;
  const email = data.email as string | null;
  const isDeactivated = data.isDeactivated as boolean;
  const signupDate = data.signupDate as string | null;
  const id = data.id as string;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <p className="text-lg font-semibold">{username}</p>
        {isDeactivated ? (
          <Badge variant="destructive">Deactivated</Badge>
        ) : (
          <Badge variant="secondary">Active</Badge>
        )}
      </div>
      {displayName && (
        <p className="text-sm text-muted-foreground">{displayName}</p>
      )}
      {email && (
        <p className="text-sm text-muted-foreground">{email}</p>
      )}
      <p className="text-xs text-muted-foreground">
        Signed up {formatDate(signupDate)}
      </p>
      <Link
        href={`/admin/users/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        View user detail
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function CardResult({ data }: { data: Record<string, unknown> }) {
  const id = data.id as string;
  const status = data.status as string;
  const score = data.score as number;
  const totalPicks = data.totalPicks as number;
  const cardSize = data.cardSize as number;
  const gameMode = data.gameMode as string;
  const createdAt = data.createdAt as string | null;
  const user = data.user as {
    id: string;
    username: string;
    displayName: string | null;
  } | null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Badge variant="outline">{status}</Badge>
        <span className="text-sm text-muted-foreground capitalize">
          {gameMode}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">Score</p>
          <p className="font-semibold">{score}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Picks</p>
          <p className="font-semibold">
            {totalPicks}/{cardSize}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Created</p>
          <p className="font-semibold">{formatDate(createdAt)}</p>
        </div>
      </div>
      {user && (
        <p className="text-sm text-muted-foreground">
          Owner:{" "}
          <Link
            href={`/admin/users/${user.id}`}
            className="text-primary hover:underline"
          >
            {user.displayName ?? user.username}
          </Link>
        </p>
      )}
      <Link
        href={`/admin/cards/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        View card detail
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function ChallengeResult({ data }: { data: Record<string, unknown> }) {
  const id = data.id as string;
  const status = data.status as string;
  const gameMode = data.gameMode as string;
  const cardSize = data.cardSize as number;
  const createdAt = data.createdAt as string | null;
  const challenger = data.challenger as {
    id: string;
    username: string;
    displayName: string | null;
  } | null;
  const opponent = data.opponent as {
    id: string;
    username: string;
    displayName: string | null;
  } | null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Badge variant="outline">{status}</Badge>
        <span className="text-sm text-muted-foreground capitalize">
          {gameMode}
        </span>
        <span className="text-sm text-muted-foreground">
          {cardSize}-pick
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        {challenger ? (
          <Link
            href={`/admin/users/${challenger.id}`}
            className="text-primary hover:underline font-medium"
          >
            {challenger.displayName ?? challenger.username}
          </Link>
        ) : (
          <span className="text-muted-foreground">Unknown</span>
        )}
        <span className="text-muted-foreground">vs</span>
        {opponent ? (
          <Link
            href={`/admin/users/${opponent.id}`}
            className="text-primary hover:underline font-medium"
          >
            {opponent.displayName ?? opponent.username}
          </Link>
        ) : (
          <span className="text-muted-foreground">Unknown</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Created {formatDate(createdAt)}
      </p>
      <Link
        href={`/admin/challenges/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        View challenge detail
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function PickResult({ data }: { data: Record<string, unknown> }) {
  const selection = data.selection as string;
  const result = data.result as string;
  const actualValue = data.actualValue as number | null;
  const cardId = data.cardId as string;
  const prop = data.prop as {
    id: string;
    playerName: string;
    statCategory: string;
    line: number;
    playerTeam: string | null;
    homeTeam: string | null;
    awayTeam: string | null;
  } | null;
  const card = data.card as {
    id: string;
    userId: string | null;
    status: string;
    user: {
      id: string;
      username: string;
      displayName: string | null;
    } | null;
  } | null;

  return (
    <div className="space-y-3">
      {prop && (
        <div>
          <p className="text-lg font-semibold">{prop.playerName}</p>
          <p className="text-sm text-muted-foreground">
            {prop.statCategory} &mdash; Line: {prop.line}
          </p>
          {prop.playerTeam && (
            <p className="text-xs text-muted-foreground">{prop.playerTeam}</p>
          )}
          {prop.homeTeam && prop.awayTeam && (
            <p className="text-xs text-muted-foreground">
              {prop.awayTeam} @ {prop.homeTeam}
            </p>
          )}
        </div>
      )}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground text-xs">Selection</p>
          <p className="font-semibold uppercase">{selection}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Result</p>
          <p className="font-semibold uppercase">{result}</p>
        </div>
        {actualValue !== null && (
          <div>
            <p className="text-muted-foreground text-xs">Actual</p>
            <p className="font-semibold">{actualValue}</p>
          </div>
        )}
      </div>
      {card?.user && (
        <p className="text-sm text-muted-foreground">
          User:{" "}
          <Link
            href={`/admin/users/${card.user.id}`}
            className="text-primary hover:underline"
          >
            {card.user.displayName ?? card.user.username}
          </Link>
        </p>
      )}
      <Link
        href={`/admin/cards/${cardId}`}
        className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        View card detail
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ResultSkeleton() {
  return (
    <Card className="mt-6">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-48" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-32" />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function RecordLookup() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<AdminLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const handleLookup = useCallback(async () => {
    const trimmed = query.trim();

    // UUID validation
    if (!trimmed) {
      setValidationError("Please enter a UUID.");
      return;
    }
    if (!UUID_REGEX.test(trimmed)) {
      setValidationError("Invalid UUID format. Expected: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx");
      return;
    }

    setValidationError(null);
    setError(null);
    setNotFound(false);
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/lookup?id=${encodeURIComponent(trimmed)}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) {
        throw new Error(
          res.status === 403
            ? "You do not have permission to perform lookups."
            : `Lookup failed (${res.status})`
        );
      }
      const data: AdminLookupResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleLookup();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    if (validationError) {
      setValidationError(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Paste a UUID to look up any record..."
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="pl-9"
            aria-invalid={!!validationError}
          />
        </div>
        <Button onClick={handleLookup} disabled={loading} className="gap-2">
          {loading ? (
            <RefreshCw className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Lookup
        </Button>
      </div>

      {/* Validation error */}
      {validationError && (
        <p className="text-sm text-destructive">{validationError}</p>
      )}

      {/* Loading skeleton */}
      {loading && <ResultSkeleton />}

      {/* Error state */}
      {error && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card p-12 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">Lookup failed</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
          <Button variant="outline" onClick={handleLookup} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {/* Not found state */}
      {notFound && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card p-12 text-center">
          <Search className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">No record found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The UUID <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{query.trim()}</code> did not match any profile, card, challenge, or pick.
            </p>
          </div>
        </div>
      )}

      {/* Result display */}
      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              {(() => {
                const config = TYPE_CONFIG[result.type];
                const Icon = config.icon;
                return (
                  <>
                    <Badge className={config.color}>
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                    <CardTitle className="text-sm font-mono text-muted-foreground">
                      {result.id}
                    </CardTitle>
                  </>
                );
              })()}
            </div>
          </CardHeader>
          <CardContent>
            {result.type === "profile" && (
              <ProfileResult data={result.data} />
            )}
            {result.type === "card" && (
              <CardResult data={result.data} />
            )}
            {result.type === "challenge" && (
              <ChallengeResult data={result.data} />
            )}
            {result.type === "pick" && (
              <PickResult data={result.data} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Layers,
  TrendingUp,
  Flame,
  Swords,
  Trophy,
  Zap,
  CalendarDays,
  RefreshCw,
  AlertCircle,
  Users,
} from "lucide-react";
import type { AdminUserDetail } from "@/lib/admin/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "\u2014";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function cardStatusVariant(status: string) {
  switch (status) {
    case "draft":
      return "secondary" as const;
    case "locked":
      return "default" as const;
    case "resolved":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

function challengeStatusVariant(status: string) {
  switch (status) {
    case "pending":
      return "secondary" as const;
    case "accepted":
      return "default" as const;
    case "active":
      return "default" as const;
    case "resolved":
      return "outline" as const;
    case "declined":
      return "destructive" as const;
    case "cancelled":
      return "secondary" as const;
    default:
      return "secondary" as const;
  }
}

function tierVariant(tier: string) {
  switch (tier) {
    case "gold":
      return "default" as const;
    case "legendary":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

function gameModeLabel(mode: string): string {
  switch (mode) {
    case "classic":
      return "Classic";
    case "turbo":
      return "Turbo";
    case "playoff":
      return "Playoff";
    case "h2h":
      return "H2H";
    default:
      return mode;
  }
}

// ---------------------------------------------------------------------------
// Stat cards config
// ---------------------------------------------------------------------------

interface StatCardConfig {
  label: string;
  icon: React.ElementType;
  getValue: (s: AdminUserDetail["stats"]) => string;
}

const statCards: StatCardConfig[] = [
  {
    label: "Total Cards",
    icon: Layers,
    getValue: (s) => s.totalCards.toLocaleString(),
  },
  {
    label: "Win Rate",
    icon: TrendingUp,
    getValue: (s) => `${s.winRate.toFixed(1)}%`,
  },
  {
    label: "Current Streak",
    icon: Flame,
    getValue: (s) => s.currentStreak.toLocaleString(),
  },
  {
    label: "Best Streak",
    icon: Zap,
    getValue: (s) => s.bestStreak.toLocaleString(),
  },
  {
    label: "Daily Streak",
    icon: CalendarDays,
    getValue: (s) => s.dailyStreak.toLocaleString(),
  },
  {
    label: "H2H Record",
    icon: Swords,
    getValue: (s) => `${s.h2hWins}W - ${s.h2hLosses}L`,
  },
];

// ---------------------------------------------------------------------------
// Skeleton components
// ---------------------------------------------------------------------------

function HeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
      <Skeleton className="size-16 rounded-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-5 w-16" />
      </div>
    </div>
  );
}

function StatsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="py-4">
          <CardHeader className="pb-0 pt-0 px-4 gap-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pt-1 pb-0">
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
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
    <div className="space-y-8">
      <HeaderSkeleton />
      <StatsGridSkeleton />
      <div className="space-y-4">
        <Skeleton className="h-9 w-80" />
        <TableSkeleton />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-sections
// ---------------------------------------------------------------------------

function UserHeader({ profile }: { profile: AdminUserDetail["profile"] }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
      <Avatar className="size-16">
        {profile.avatarUrl && (
          <AvatarImage src={profile.avatarUrl} alt={profile.username} />
        )}
        <AvatarFallback className="text-lg">
          {profile.username.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">
            {profile.username}
          </h2>
          {profile.isDeactivated ? (
            <Badge variant="destructive">Deactivated</Badge>
          ) : (
            <Badge variant="secondary">Active</Badge>
          )}
        </div>

        {profile.displayName && (
          <p className="text-sm text-muted-foreground">
            {profile.displayName}
          </p>
        )}

        {profile.email && (
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        )}

        <p className="text-xs text-muted-foreground">
          Signed up {formatDate(profile.signupDate)}
        </p>
      </div>
    </div>
  );
}

function StatsGrid({ stats }: { stats: AdminUserDetail["stats"] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {statCards.map((config) => {
        const Icon = config.icon;
        return (
          <Card key={config.label} className="py-4">
            <CardHeader className="pb-0 pt-0 px-4 gap-1">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {config.label}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-4 pt-1 pb-0">
              <p className="text-2xl font-bold tracking-tight">
                {config.getValue(stats)}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function RecentCardsTable({
  cards,
}: {
  cards: AdminUserDetail["recentCards"];
}) {
  if (cards.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No cards yet
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Picks</TableHead>
          <TableHead>Game Mode</TableHead>
          <TableHead>Locked At</TableHead>
          <TableHead>Resolved At</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cards.map((card) => (
          <TableRow key={card.id}>
            <TableCell>
              <Badge variant={cardStatusVariant(card.status)}>
                {card.status}
              </Badge>
            </TableCell>
            <TableCell className="font-medium">{card.score}</TableCell>
            <TableCell>
              {card.totalPicks}/{card.cardSize}
            </TableCell>
            <TableCell>{gameModeLabel(card.gameMode)}</TableCell>
            <TableCell className="text-muted-foreground text-xs">
              {formatDateTime(card.lockedAt)}
            </TableCell>
            <TableCell className="text-muted-foreground text-xs">
              {formatDateTime(card.resolvedAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RecentChallengesTable({
  challenges,
  userId,
}: {
  challenges: AdminUserDetail["recentChallenges"];
  userId: string;
}) {
  if (challenges.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No challenges yet
      </p>
    );
  }

  function winnerLabel(
    winnerId: string | null,
    currentUserId: string,
    opponentUsername: string
  ): string {
    if (!winnerId) return "\u2014";
    if (winnerId === currentUserId) return "You";
    return opponentUsername;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Opponent</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Game Mode</TableHead>
          <TableHead>Winner</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Resolved</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {challenges.map((ch) => (
          <TableRow key={ch.id}>
            <TableCell>
              <Link
                href={`/admin/users/${ch.opponentUsername}`}
                className="text-primary hover:underline"
              >
                {ch.opponentDisplayName ?? ch.opponentUsername}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant={challengeStatusVariant(ch.status)}>
                {ch.status}
              </Badge>
            </TableCell>
            <TableCell>{gameModeLabel(ch.gameMode)}</TableCell>
            <TableCell className="font-medium">
              {winnerLabel(ch.winnerId, userId, ch.opponentUsername)}
            </TableCell>
            <TableCell className="text-muted-foreground text-xs">
              {formatDateTime(ch.createdAt)}
            </TableCell>
            <TableCell className="text-muted-foreground text-xs">
              {formatDateTime(ch.resolvedAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AchievementsGrid({
  achievements,
}: {
  achievements: AdminUserDetail["achievements"];
}) {
  if (achievements.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No achievements unlocked
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {achievements.map((ach) => (
        <Card key={ach.id} className="py-3">
          <CardContent className="px-4 pb-0 pt-0 flex flex-col items-center text-center gap-1.5">
            <span className="text-2xl" role="img" aria-label={ach.name}>
              {ach.icon}
            </span>
            <p className="text-sm font-medium leading-tight">{ach.name}</p>
            <Badge variant={tierVariant(ach.tier)} className="text-[10px]">
              {ach.tier}
            </Badge>
            <p className="text-[11px] text-muted-foreground">
              {formatDate(ach.unlockedAt)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function FriendsCard({ friendCount }: { friendCount: number }) {
  return (
    <Card className="py-4">
      <CardHeader className="pb-0 pt-0 px-4 gap-1">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-xs font-medium text-muted-foreground">
            Friends
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-1 pb-0">
        <p className="text-2xl font-bold tracking-tight">
          {friendCount.toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function UserDetail({ userId }: { userId: string }) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      if (res.status === 404) {
        throw new Error("User not found");
      }
      if (!res.ok) {
        throw new Error(
          res.status === 403
            ? "You do not have permission to view this user."
            : `Failed to load user detail (${res.status})`
        );
      }
      const data: AdminUserDetail = await res.json();
      setDetail(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Back link (always visible)
  const backLink = (
    <Link
      href="/admin/users"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to Users
    </Link>
  );

  // Error / 404 state
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
    <div className="space-y-8">
      {/* Back link */}
      {backLink}

      {/* Header */}
      <UserHeader profile={detail.profile} />

      {/* Stats grid */}
      <StatsGrid stats={detail.stats} />

      {/* Tabbed content */}
      <Tabs defaultValue="cards">
        <TabsList>
          <TabsTrigger value="cards">
            Cards ({detail.recentCards.length})
          </TabsTrigger>
          <TabsTrigger value="challenges">
            Challenges ({detail.recentChallenges.length})
          </TabsTrigger>
          <TabsTrigger value="achievements">
            Achievements ({detail.achievements.length})
          </TabsTrigger>
          <TabsTrigger value="friends">
            Friends ({detail.friendCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cards" className="mt-4">
          <RecentCardsTable cards={detail.recentCards} />
        </TabsContent>

        <TabsContent value="challenges" className="mt-4">
          <RecentChallengesTable
            challenges={detail.recentChallenges}
            userId={userId}
          />
        </TabsContent>

        <TabsContent value="achievements" className="mt-4">
          <AchievementsGrid achievements={detail.achievements} />
        </TabsContent>

        <TabsContent value="friends" className="mt-4">
          <FriendsCard friendCount={detail.friendCount} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

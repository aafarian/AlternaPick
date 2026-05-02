"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { logWarn } from "@/lib/logger";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
  ArrowLeft,
  Layers,
  TrendingUp,
  Flame,
  Swords,
  Zap,
  CalendarDays,
  RefreshCw,
  AlertCircle,
  Users,
  Trash2,
  XCircle,
  Loader2,
} from "lucide-react";
import FlameTokenIcon from "@/components/icons/FlameTokenIcon";
import ModerationActions from "@/components/admin/ModerationActions";
import NotificationPreferencesPanel from "@/components/admin/NotificationPreferencesPanel";
import type { AdminUserDetail } from "@/lib/admin/types";
import {
  formatDate,
  formatDateTime,
  cardStatusVariant,
  challengeStatusVariant,
  gameModeLabel,
} from "@/lib/admin/helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
// Flame Token Adjuster
// ---------------------------------------------------------------------------

function FireTokenAdjuster({ userId }: { userId: string }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [lifetime, setLifetime] = useState<number | null>(null);

  // Fetch current balance on mount
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/fire-tokens?user_id=${userId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!cancelled && data) {
          setBalance(data.balance ?? null);
          setLifetime(data.lifetime ?? null);
        }
      })
      .catch((err) => { logWarn("user-detail", "Failed to fetch flame token balance", err); });
    return () => { cancelled = true; };
  }, [userId]);

  async function handleAdjust() {
    const num = parseInt(amount, 10);
    if (isNaN(num) || num === 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/admin/fire-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, amount: num, reason: reason.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setBalance(data.new_balance);
        setAmount("");
        setReason("");
        toast.success(`Tokens adjusted: ${data.previous_balance} → ${data.new_balance}`);
      } else {
        toast.error(data.error ?? "Failed to adjust tokens");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="py-4">
      <CardHeader className="pb-2 pt-0 px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <FlameTokenIcon className="h-4 w-4 text-orange-400" />
          Flame Tokens
          {balance != null && (
            <span className="text-orange-400 font-bold tabular-nums">
              {balance.toLocaleString()}
            </span>
          )}
          {lifetime != null && (
            <span className="text-muted-foreground text-xs font-normal">
              (lifetime: {lifetime.toLocaleString()})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-0 pt-0">
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (+/-)"
            className="w-28 text-sm"
          />
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="flex-1 text-sm"
          />
          <Button
            onClick={handleAdjust}
            disabled={loading || !amount || parseInt(amount, 10) === 0}
            size="sm"
            variant="outline"
            className="shrink-0"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Adjust"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

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

// ---------------------------------------------------------------------------
// Inline moderation action button (used in tables for delete/cancel)
// ---------------------------------------------------------------------------

function InlineActionButton({
  icon: Icon,
  title,
  description,
  action,
  targetId,
  onActionComplete,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action: string;
  targetId: string;
  onActionComplete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, targetId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data?.error ?? data?.message ?? `Action failed (${res.status})`
        );
      }
      toast.success(data.message ?? "Action completed successfully");
      setOpen(false);
      onActionComplete();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setLoading(false);
    }
  }, [action, targetId, onActionComplete]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7">
          <Icon className="h-4 w-4 text-muted-foreground hover:text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading}
            className="gap-1.5"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RecentCardsTable({
  cards,
  onActionComplete,
}: {
  cards: AdminUserDetail["recentCards"];
  onActionComplete: () => void;
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
          <TableHead>Card ID</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Score</TableHead>
          <TableHead>Picks</TableHead>
          <TableHead>Game Mode</TableHead>
          <TableHead>Locked At</TableHead>
          <TableHead>Resolved At</TableHead>
          <TableHead className="w-12">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cards.map((card) => (
          <TableRow key={card.id} className="cursor-pointer hover:bg-muted/50" onClick={() => window.location.href = `/admin/lookup/card/${card.id}`}>
            <TableCell>
              <Link
                href={`/admin/lookup/card/${card.id}`}
                className="font-mono text-xs text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {card.id.slice(0, 8)}
              </Link>
            </TableCell>
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
            <TableCell>
              <span onClick={(e) => e.stopPropagation()}>
                <InlineActionButton
                  icon={Trash2}
                  title="Delete this card?"
                  description="This will remove the card and all its picks."
                  action="delete_card"
                  targetId={card.id}
                  onActionComplete={onActionComplete}
                />
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Statuses where a challenge can still be cancelled by an admin */
const CANCELLABLE_STATUSES = new Set(["pending", "accepted", "active"]);

function RecentChallengesTable({
  challenges,
  userId,
  username,
  onActionComplete,
}: {
  challenges: AdminUserDetail["recentChallenges"];
  userId: string;
  username: string;
  onActionComplete: () => void;
}) {
  if (challenges.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No challenges yet
      </p>
    );
  }

  function winnerLabel(
    ch: AdminUserDetail["recentChallenges"][number],
    currentUserId: string,
    currentUsername: string,
  ): string {
    if (!ch.winnerId) return "\u2014";
    if (ch.winnerId === currentUserId) return currentUsername;
    // 1v1: fall back to the opponent username if it matches
    if (ch.lobbyType === "1v1") return ch.opponentUsername ?? "\u2014";
    // Group: use the resolved winner username from the API
    return ch.winnerUsername ?? "\u2014";
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
          <TableHead className="w-12">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {challenges.map((ch) => (
          <TableRow key={ch.id}>
            <TableCell>
              {ch.lobbyType === "group" ? (
                <Link
                  href={`/admin/lookup/challenge/${ch.id}`}
                  className="text-primary hover:underline"
                >
                  {ch.participantCount
                    ? `${ch.participantCount}-player group`
                    : "Group"}
                </Link>
              ) : ch.opponentId ? (
                <Link
                  href={`/admin/users/${ch.opponentId}`}
                  className="text-primary hover:underline"
                >
                  {ch.opponentDisplayName ?? ch.opponentUsername ?? "Unknown"}
                </Link>
              ) : (
                <span className="text-muted-foreground">
                  {ch.opponentDisplayName ?? ch.opponentUsername ?? "Unknown"}
                </span>
              )}
            </TableCell>
            <TableCell>
              <Badge variant={challengeStatusVariant(ch.status)}>
                {ch.status}
              </Badge>
            </TableCell>
            <TableCell>{gameModeLabel(ch.gameMode)}</TableCell>
            <TableCell className="font-medium">
              {winnerLabel(ch, userId, username)}
            </TableCell>
            <TableCell className="text-muted-foreground text-xs">
              {formatDateTime(ch.createdAt)}
            </TableCell>
            <TableCell className="text-muted-foreground text-xs">
              {formatDateTime(ch.resolvedAt)}
            </TableCell>
            <TableCell>
              {CANCELLABLE_STATUSES.has(ch.status) && (
                <InlineActionButton
                  icon={XCircle}
                  title="Cancel this challenge?"
                  description="This will cancel the challenge for both players."
                  action="delete_challenge"
                  targetId={ch.id}
                  onActionComplete={onActionComplete}
                />
              )}
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
        throw new Error(`Failed to load user detail (${res.status})`);
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

      {/* Flame Token Adjustment */}
      <FireTokenAdjuster userId={detail.profile.id} />

      {/* Moderation Actions */}
      <Card className="py-4">
        <CardHeader className="pb-2 pt-0 px-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Moderation
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-0 pt-0">
          <ModerationActions
            userId={detail.profile.id}
            username={detail.profile.username}
            email={detail.profile.email}
            isDeactivated={detail.profile.isDeactivated}
            onActionComplete={fetchDetail}
          />
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <NotificationPreferencesPanel
        userId={detail.profile.id}
        username={detail.profile.username}
        initialPreferences={detail.profile.notificationPreferences}
      />

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
          <RecentCardsTable
            cards={detail.recentCards}
            onActionComplete={fetchDetail}
          />
        </TabsContent>

        <TabsContent value="challenges" className="mt-4">
          <RecentChallengesTable
            challenges={detail.recentChallenges}
            userId={userId}
            username={detail.profile.username}
            onActionComplete={fetchDetail}
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

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { AdminOverviewStats } from "@/lib/admin/types";
import {
  Users,
  UserPlus,
  UserCheck,
  Activity,
  Lock,
  Crosshair,
  Swords,
  TrendingUp,
  Layers,
  RefreshCw,
  CalendarDays,
  Target,
} from "lucide-react";
import FlameTokenIcon from "@/components/icons/FlameTokenIcon";

interface StatCardConfig {
  key: keyof AdminOverviewStats;
  label: string;
  icon: React.ElementType;
  format?: (value: number) => string;
  subtitle?: (stats: AdminOverviewStats) => string | undefined;
}

const statCards: StatCardConfig[] = [
  // User stats
  {
    key: "totalUsers",
    label: "Total Users",
    icon: Users,
    subtitle: (s) => `${s.signupsThisWeek.toLocaleString()} new this week`,
  },
  {
    key: "signupsToday",
    label: "New Today",
    icon: UserPlus,
  },
  {
    key: "dailyActiveUsers",
    label: "DAU",
    icon: UserCheck,
  },
  {
    key: "weeklyActiveUsers",
    label: "WAU",
    icon: CalendarDays,
    subtitle: (s) => s.dailyActiveUsers > 0 ? `DAU/WAU: ${Math.round((s.dailyActiveUsers / s.weeklyActiveUsers) * 100)}%` : undefined,
  },
  // Activity stats
  {
    key: "cardsLockedToday",
    label: "Cards Locked Today",
    icon: Lock,
  },
  {
    key: "picksMadeToday",
    label: "Picks Today",
    icon: Crosshair,
  },
  {
    key: "activeChallenges",
    label: "Active Challenges",
    icon: Swords,
  },
  // Platform stats
  {
    key: "avgWinRate",
    label: "Average Win Rate",
    icon: TrendingUp,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: "totalCards",
    label: "Total Cards",
    icon: Layers,
  },
  {
    key: "wageredCardsToday",
    label: "Wagers Today",
    icon: FlameTokenIcon,
  },
  {
    key: "questsCompletedToday",
    label: "Quests Today",
    icon: Target,
  },
];

function StatCardSkeleton() {
  return (
    <Card className="py-4">
      <CardHeader className="pb-0 pt-0 px-4 gap-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-3.5 w-24" />
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-1 pb-0">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="mt-1.5 h-3 w-20" />
      </CardContent>
    </Card>
  );
}

export default function OverviewStats() {
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/overview");
      if (!res.ok) {
        throw new Error(`Failed to load stats (${res.status})`);
      }
      const data: AdminOverviewStats = await res.json();
      setStats(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card p-12 text-center">
        <Activity className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium text-foreground">
            Unable to load overview stats
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
        <Button variant="outline" onClick={fetchStats} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div />
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchStats}
          disabled={loading}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: statCards.length }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))
          : statCards.map((config) => {
              const Icon = config.icon;
              const value = stats?.[config.key] ?? 0;
              const formatted = config.format
                ? config.format(value)
                : value.toLocaleString();
              const subtitle = config.subtitle && stats ? config.subtitle(stats) : null;

              return (
                <Card key={config.key} className="py-4">
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
                      {formatted}
                    </p>
                    {subtitle && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {subtitle}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
      </div>
    </div>
  );
}

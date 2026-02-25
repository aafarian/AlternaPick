"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { AdminSystemHealth } from "@/lib/admin/types";
import { timeAgo } from "@/lib/admin/helpers";
import {
  RefreshCw,
  Database,
  Clock,
  CalendarClock,
  Radio,
  Trophy,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** How often to auto-refresh (ms) */
const AUTO_REFRESH_INTERVAL = 60_000;

function syncHealthColor(lastSyncAt: string | null): {
  dot: string;
  label: string;
} {
  if (!lastSyncAt) return { dot: "bg-gray-400", label: "Unknown" };

  const diffMs = Date.now() - new Date(lastSyncAt).getTime();
  const hours = diffMs / (1000 * 60 * 60);

  if (hours < 6) return { dot: "bg-emerald-500", label: "Healthy" };
  if (hours < 24) return { dot: "bg-amber-500", label: "Warning" };
  return { dot: "bg-red-500", label: "Stale" };
}

// ---------------------------------------------------------------------------
// Skeleton loaders
// ---------------------------------------------------------------------------

function PropSyncSkeleton() {
  return (
    <Card className="py-4">
      <CardHeader className="pb-0 pt-0 px-4 gap-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-28" />
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-3 pb-0 space-y-3">
        <Skeleton className="h-4 w-48" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

function GameScheduleSkeleton() {
  return (
    <Card className="py-4">
      <CardHeader className="pb-0 pt-0 px-4 gap-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-32" />
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-3 pb-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function AlertsSkeleton() {
  return (
    <Card className="py-4">
      <CardHeader className="pb-0 pt-0 px-4 gap-1">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-28" />
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-3 pb-0 space-y-2">
        <Skeleton className="h-10 rounded-lg" />
        <Skeleton className="h-10 rounded-lg" />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Sub-sections
// ---------------------------------------------------------------------------

function PropSyncSection({ data }: { data: AdminSystemHealth["propSync"] }) {
  const health = syncHealthColor(data.lastSyncAt);

  return (
    <Card className="py-4">
      <CardHeader className="pb-0 pt-0 px-4 gap-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">
              Prop Sync Status
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${health.dot}`}
            />
            <span className="text-xs text-muted-foreground">
              {health.label}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-3 pb-0 space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {data.lastSyncAt ? (
            <span>
              Last sync:{" "}
              <span className="font-medium text-foreground">
                {timeAgo(data.lastSyncAt)}
              </span>
              <span className="ml-1.5 text-xs">
                ({new Date(data.lastSyncAt).toLocaleString()})
              </span>
            </span>
          ) : (
            <span>No sync data available</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Total Props</p>
            <p className="text-xl font-bold tracking-tight">
              {data.totalProps.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Fetched Today</p>
            <p className="text-xl font-bold tracking-tight">
              {data.propsToday.toLocaleString()}
            </p>
          </div>
        </div>

        {data.creditsRemaining !== null && (
          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Odds API Credits</p>
                <p className="text-xl font-bold tracking-tight">
                  {data.creditsRemaining.toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground ml-1">remaining</span>
                </p>
              </div>
              {data.creditsUsed !== null && (
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Used</p>
                  <p className="text-lg font-semibold tracking-tight text-muted-foreground">
                    {data.creditsUsed.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const gameCards: {
  key: keyof AdminSystemHealth["games"];
  label: string;
  icon: React.ElementType;
}[] = [
  { key: "scheduledToday", label: "Scheduled", icon: CalendarClock },
  { key: "liveNow", label: "Live", icon: Radio },
  { key: "finalToday", label: "Final", icon: Trophy },
  { key: "totalToday", label: "Total Today", icon: CalendarDays },
];

function GameScheduleSection({
  data,
}: {
  data: AdminSystemHealth["games"];
}) {
  return (
    <Card className="py-4">
      <CardHeader className="pb-0 pt-0 px-4 gap-1">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">
            Game Schedule
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-3 pb-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {gameCards.map(({ key, label, icon: Icon }) => (
            <div
              key={key}
              className="rounded-lg border bg-muted/40 p-3 text-center"
            >
              <Icon className="mx-auto h-4 w-4 text-muted-foreground mb-1" />
              <p className="text-xl font-bold tracking-tight">
                {data[key].toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SystemAlertsSection({
  data,
}: {
  data: AdminSystemHealth["errors"];
}) {
  const alerts = data.recentApiErrors;

  return (
    <Card className="py-4">
      <CardHeader className="pb-0 pt-0 px-4 gap-1">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">
            System Alerts
          </CardTitle>
          {alerts.length > 0 && (
            <Badge
              variant="destructive"
              className="ml-1 text-[10px] px-1.5 py-0"
            >
              {alerts.length}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-3 pb-0">
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border bg-emerald-500/10 p-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              No issues detected
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-lg border bg-red-500/5 p-3"
              >
                <AlertCircle className="h-4 w-4 mt-0.5 text-red-600 dark:text-red-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{alert.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {timeAgo(alert.timestamp)}
                    {alert.endpoint && (
                      <span className="ml-1.5">
                        &middot; {alert.endpoint}
                      </span>
                    )}
                  </p>
                </div>
                <Badge
                  variant="destructive"
                  className="text-[10px] shrink-0"
                >
                  Warning
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RuntimeErrorsSection({
  errors,
}: {
  errors: AdminSystemHealth["errors"]["runtimeErrors"];
}) {
  return (
    <Card className="py-4">
      <CardHeader className="pb-0 pt-0 px-4 gap-1">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-medium">
            Runtime Errors
          </CardTitle>
          {errors.length > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 text-[10px] px-1.5 py-0"
            >
              {errors.length}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-3 pb-0">
        {errors.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border bg-emerald-500/10 p-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
              No runtime errors since last restart
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {errors.map((entry, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-lg border bg-amber-500/5 p-3"
              >
                <AlertCircle className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground break-words">{entry.message}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {timeAgo(entry.timestamp)}
                    {entry.endpoint && (
                      <span className="ml-1.5">
                        &middot; {entry.endpoint}
                      </span>
                    )}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] shrink-0"
                >
                  {entry.category}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SystemHealth() {
  const [health, setHealth] = useState<AdminSystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchHealth = useCallback(async (isBackground = false) => {
    if (isBackground) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await fetch("/api/admin/system");
      if (!res.ok) {
        throw new Error(`Failed to load system health (${res.status})`);
      }
      const data: AdminSystemHealth = await res.json();
      setHealth(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Fetch on mount + auto-refresh (background)
  useEffect(() => {
    fetchHealth(false);

    intervalRef.current = setInterval(() => {
      fetchHealth(true);
    }, AUTO_REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchHealth]);

  // Error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border bg-card p-12 text-center">
        <AlertTriangle className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium text-foreground">
            Unable to load system health
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        </div>
        <Button variant="outline" onClick={() => { fetchHealth(false); }} className="gap-2">
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
          onClick={() => { fetchHealth(!!health); }}
          disabled={loading || isRefreshing}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`}
          />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {loading && !health ? (
        <div className="space-y-4">
          <PropSyncSkeleton />
          <GameScheduleSkeleton />
          <AlertsSkeleton />
        </div>
      ) : health ? (
        <div className="space-y-4">
          <PropSyncSection data={health.propSync} />
          <GameScheduleSection data={health.games} />
          <SystemAlertsSection data={health.errors} />
          <RuntimeErrorsSection errors={health.errors.runtimeErrors} />
        </div>
      ) : null}
    </div>
  );
}

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
import type { AdminSystemHealth, StalePickDetail, LockedCardDetail } from "@/lib/admin/types";
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
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { ReResolvePickLog, ReResolveSkipLog } from "@/lib/cards/resolution";

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
              <div className="flex items-center gap-4">
                {data.avgCreditsPerHour !== null && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Avg/Hour (24h)</p>
                    <p className="text-lg font-semibold tracking-tight text-muted-foreground">
                      {data.avgCreditsPerHour}
                    </p>
                  </div>
                )}
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

// ---------------------------------------------------------------------------
// Card-level log from fix-card endpoint
// ---------------------------------------------------------------------------

type CardLog = {
  cardId: string;
  preview: string;
  resolved: boolean;
  gamesUpdated: number;
  score?: number;
  total?: number;
  error?: string;
  debug?: Record<string, unknown>[];
};

// ---------------------------------------------------------------------------
// Re-sync result with full detail
// ---------------------------------------------------------------------------

type SyncResultDetail = {
  cardLogs: CardLog[];
  reResolve: {
    totalStale: number;
    picksUpdated: number;
    cardsRescored: number;
    logs: ReResolvePickLog[];
    skipped: ReResolveSkipLog[];
  } | null;
  error?: string;
};

// ---------------------------------------------------------------------------
// Expandable log sections
// ---------------------------------------------------------------------------

function SyncResultPanel({ result }: { result: SyncResultDetail }) {
  const [showCardLogs, setShowCardLogs] = useState(false);
  const [showPickLogs, setShowPickLogs] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);

  const resolvedCount = result.cardLogs.filter((c) => c.resolved).length;
  const failedCount = result.cardLogs.filter((c) => c.error).length;
  const rr = result.reResolve;

  return (
    <div className="mb-3 space-y-2">
      {/* Summary bar */}
      <div className="rounded-lg border bg-blue-500/10 p-3 space-y-1">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <p className="text-sm font-medium text-foreground">Re-sync complete</p>
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5 ml-6">
          <p>
            Locked cards: {result.cardLogs.length} processed, {resolvedCount} resolved
            {failedCount > 0 && `, ${failedCount} failed`}
          </p>
          {rr && (
            <p>
              Stale picks: {rr.totalStale} found, {rr.picksUpdated} updated, {rr.cardsRescored} card(s) rescored
            </p>
          )}
        </div>
      </div>

      {/* Locked card details */}
      {result.cardLogs.length > 0 && (
        <div className="rounded-lg border bg-muted/40">
          <button
            type="button"
            onClick={() => setShowCardLogs(!showCardLogs)}
            className="flex w-full items-center gap-2 p-3 text-left text-sm font-medium hover:bg-muted/60 transition-colors"
          >
            {showCardLogs ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Locked Card Details ({result.cardLogs.length})
          </button>
          {showCardLogs && (
            <div className="border-t px-3 pb-3 space-y-2">
              {result.cardLogs.map((log) => (
                <div key={log.cardId} className="rounded border bg-background p-2.5 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground truncate">{log.preview || log.cardId.slice(0, 8)}</span>
                    <Badge
                      variant={log.resolved ? "default" : log.error ? "destructive" : "secondary"}
                      className="text-[10px] shrink-0"
                    >
                      {log.resolved ? `Resolved ${log.score}/${log.total}` : log.error ? "Failed" : "Not resolved"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {log.gamesUpdated} game(s) synced
                    {log.error && <span className="text-red-500 ml-1">{log.error}</span>}
                  </p>
                  {log.debug && log.debug.length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                        Debug ({log.debug.length} game(s))
                      </summary>
                      <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-[10px] leading-relaxed whitespace-pre-wrap">
                        {JSON.stringify(log.debug, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Re-resolve pick updates */}
      {rr && rr.logs.length > 0 && (
        <div className="rounded-lg border bg-muted/40">
          <button
            type="button"
            onClick={() => setShowPickLogs(!showPickLogs)}
            className="flex w-full items-center gap-2 p-3 text-left text-sm font-medium hover:bg-muted/60 transition-colors"
          >
            {showPickLogs ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Picks Updated ({rr.logs.length})
          </button>
          {showPickLogs && (
            <div className="border-t px-3 pb-3">
              <table className="w-full text-xs mt-2">
                <thead>
                  <tr className="text-muted-foreground text-left">
                    <th className="pb-1.5 font-medium">Player</th>
                    <th className="pb-1.5 font-medium">Stat</th>
                    <th className="pb-1.5 font-medium">Line</th>
                    <th className="pb-1.5 font-medium">Actual</th>
                    <th className="pb-1.5 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rr.logs.map((log, i) => (
                    <tr key={i}>
                      <td className="py-1.5 font-medium text-foreground">{log.player}</td>
                      <td className="py-1.5 text-muted-foreground">{log.stat} {log.selection} {log.line}</td>
                      <td className="py-1.5">{log.line}</td>
                      <td className="py-1.5">{log.actualValue ?? "DNP"}</td>
                      <td className="py-1.5">
                        <span className="text-muted-foreground">{log.oldResult}</span>
                        <span className="mx-1">→</span>
                        <span className={log.newResult === "hit" ? "text-emerald-500" : log.newResult === "miss" ? "text-red-500" : "text-amber-500"}>
                          {log.newResult}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Skipped picks */}
      {rr && rr.skipped.length > 0 && (
        <div className="rounded-lg border bg-muted/40">
          <button
            type="button"
            onClick={() => setShowSkipped(!showSkipped)}
            className="flex w-full items-center gap-2 p-3 text-left text-sm font-medium hover:bg-muted/60 transition-colors"
          >
            {showSkipped ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            Skipped Picks ({rr.skipped.length})
          </button>
          {showSkipped && (
            <div className="border-t px-3 pb-3">
              <table className="w-full text-xs mt-2">
                <thead>
                  <tr className="text-muted-foreground text-left">
                    <th className="pb-1.5 font-medium">Player</th>
                    <th className="pb-1.5 font-medium">Stat</th>
                    <th className="pb-1.5 font-medium">Sport</th>
                    <th className="pb-1.5 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rr.skipped.map((log, i) => (
                    <tr key={i}>
                      <td className="py-1.5 font-medium text-foreground">{log.player}</td>
                      <td className="py-1.5 text-muted-foreground">{log.stat}</td>
                      <td className="py-1.5 text-muted-foreground">{log.sport ?? "—"}</td>
                      <td className="py-1.5 text-muted-foreground">{log.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StaleAlertRow({ alert }: { alert: AdminSystemHealth["errors"]["recentApiErrors"][number] }) {
  const [expanded, setExpanded] = useState(false);
  const stalePicks = (alert as { stalePicks?: StalePickDetail[] }).stalePicks;
  const lockedCards = (alert as { lockedCards?: LockedCardDetail[] }).lockedCards;
  const hasDetails = (stalePicks && stalePicks.length > 0) || (lockedCards && lockedCards.length > 0);

  return (
    <div className="rounded-lg border bg-red-500/5">
      <button
        type="button"
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={`flex w-full items-start gap-3 p-3 text-left ${hasDetails ? "cursor-pointer hover:bg-red-500/10 transition-colors" : ""}`}
      >
        <AlertCircle className="h-4 w-4 mt-0.5 text-red-600 dark:text-red-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {hasDetails && (
              expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />
            )}
            <p className="text-sm text-foreground">{alert.message}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {timeAgo(alert.timestamp)}
            {alert.endpoint && (
              <span className="ml-1.5">&middot; {alert.endpoint}</span>
            )}
          </p>
        </div>
        <Badge variant="destructive" className="text-[10px] shrink-0">
          Warning
        </Badge>
      </button>
      {expanded && stalePicks && stalePicks.length > 0 && (
        <div className="border-t px-3 pb-3">
          <table className="w-full text-xs mt-2">
            <thead>
              <tr className="text-muted-foreground text-left">
                <th className="pb-1.5 font-medium">Player</th>
                <th className="pb-1.5 font-medium">Stat</th>
                <th className="pb-1.5 font-medium">Line</th>
                <th className="pb-1.5 font-medium">Sport</th>
                <th className="pb-1.5 font-medium">Game</th>
                <th className="pb-1.5 font-medium">Event ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stalePicks.map((pick) => (
                <tr key={pick.pickId}>
                  <td className="py-1.5 font-medium text-foreground">{pick.player}</td>
                  <td className="py-1.5 text-muted-foreground">{pick.stat}</td>
                  <td className="py-1.5">{pick.line}</td>
                  <td className="py-1.5 text-muted-foreground">{pick.sport ?? "—"}</td>
                  <td className="py-1.5 text-muted-foreground truncate max-w-[200px]">{pick.game ?? "—"}</td>
                  <td className="py-1.5 text-muted-foreground font-mono text-[10px]">{pick.eventId ?? "none"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {expanded && lockedCards && lockedCards.length > 0 && (
        <div className="border-t px-3 pb-3 space-y-2 mt-0">
          {lockedCards.map((card) => (
            <div key={card.cardId} className="rounded border bg-background p-2.5 text-xs space-y-1.5 mt-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">
                  {card.username ?? "Unknown user"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground font-mono text-[10px]">{card.cardId.slice(0, 8)}</span>
                  {card.lockedAt && (
                    <span className="text-muted-foreground">locked {timeAgo(card.lockedAt)}</span>
                  )}
                </div>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="text-muted-foreground text-left">
                    <th className="pb-1 font-medium">Player</th>
                    <th className="pb-1 font-medium">Stat</th>
                    <th className="pb-1 font-medium">Line</th>
                    <th className="pb-1 font-medium">Result</th>
                    <th className="pb-1 font-medium">Game Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {card.picks.map((pick, i) => (
                    <tr key={i}>
                      <td className="py-1 font-medium text-foreground">{pick.player}</td>
                      <td className="py-1 text-muted-foreground">{pick.stat}</td>
                      <td className="py-1">{pick.line}</td>
                      <td className="py-1">
                        <span className={
                          pick.result === "hit" ? "text-emerald-500" :
                          pick.result === "miss" ? "text-red-500" :
                          pick.result === "dnp" ? "text-amber-500" :
                          "text-muted-foreground"
                        }>
                          {pick.result}
                        </span>
                      </td>
                      <td className="py-1 text-muted-foreground">{pick.gameStatus ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SystemAlertsSection({
  data,
  onRefresh,
}: {
  data: AdminSystemHealth["errors"];
  onRefresh: () => void;
}) {
  const alerts = data.recentApiErrors;
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResultDetail | null>(null);

  const hasStaleAlert = alerts.some((a) => a.message.includes("pending on resolved") || a.message.includes("locked card"));

  async function handleResyncAll() {
    setSyncing(true);
    setSyncResult(null);
    try {
      // 1. Get all locked cards
      const listRes = await fetch("/api/admin/fix-card/bulk");
      if (!listRes.ok) throw new Error("Failed to fetch locked cards");
      const { cards } = await listRes.json();

      const cardLogs: CardLog[] = [];

      // 2. Fix each locked card sequentially
      for (const card of cards ?? []) {
        try {
          const res = await fetch("/api/admin/fix-card", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cardId: card.cardId }),
          });
          if (res.ok) {
            const data = await res.json();
            cardLogs.push({
              cardId: card.cardId,
              preview: card.preview ?? "",
              resolved: !!data.resolved,
              gamesUpdated: data.gamesUpdated ?? 0,
              score: data.score,
              total: data.total,
              debug: data.debug,
            });
          } else {
            const errText = await res.text().catch(() => "Unknown error");
            cardLogs.push({
              cardId: card.cardId,
              preview: card.preview ?? "",
              resolved: false,
              gamesUpdated: 0,
              error: `HTTP ${res.status}: ${errText.slice(0, 200)}`,
            });
          }
        } catch (err) {
          cardLogs.push({
            cardId: card.cardId,
            preview: card.preview ?? "",
            resolved: false,
            gamesUpdated: 0,
            error: String(err),
          });
        }
      }

      // 3. Also re-resolve stale picks on already-resolved cards
      let reResolve: SyncResultDetail["reResolve"] = null;
      try {
        const reRes = await fetch("/api/admin/re-resolve", { method: "POST" });
        if (reRes.ok) {
          reResolve = await reRes.json();
        }
      } catch {
        // Non-critical
      }

      setSyncResult({ cardLogs, reResolve });
      onRefresh();
    } catch (err) {
      setSyncResult({ cardLogs: [], reResolve: null, error: String(err) });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card className="py-4">
      <CardHeader className="pb-0 pt-0 px-4 gap-1">
        <div className="flex items-center justify-between">
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
          {hasStaleAlert && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResyncAll}
              disabled={syncing}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Re-syncing..." : "Re-sync All Cards"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-3 pb-0">
        {syncResult && (
          syncResult.error ? (
            <div className="mb-3 flex items-center gap-2 rounded-lg border bg-red-500/10 p-3">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
              <p className="text-sm text-foreground">Re-sync failed: {syncResult.error}</p>
            </div>
          ) : (
            <SyncResultPanel result={syncResult} />
          )
        )}
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
              <StaleAlertRow key={idx} alert={alert} />
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
          <SystemAlertsSection data={health.errors} onRefresh={() => fetchHealth(true)} />
          <RuntimeErrorsSection errors={health.errors.runtimeErrors} />
        </div>
      ) : null}
    </div>
  );
}

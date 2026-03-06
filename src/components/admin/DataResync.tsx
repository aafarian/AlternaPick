"use client";

import { useCallback, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  RotateCcw,
  BarChart3,
  Users,
  CalendarDays,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import type { CardScoreFix } from "@/lib/admin/resync";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StepStatus = "idle" | "running" | "success" | "error";

interface StepState {
  status: StepStatus;
  result?: Record<string, unknown>;
  error?: string;
}

interface ReResolveResult {
  picksUpdated: number;
  cardsRescored: number;
}

interface CardScoresResult {
  cardsChecked: number;
  cardsFixed: number;
  fixes: CardScoreFix[];
}

interface LeaderboardResult {
  usersProcessed: number;
  usersErrored: number;
}

interface FullResyncSummary {
  picksUpdated: number;
  cardsRescored: number;
  cardsFixed: number;
  usersProcessed: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "error":
      return <AlertCircle className="h-4 w-4 text-red-400" />;
    default:
      return null;
  }
}

function ResultDisplay({ result }: { result: Record<string, unknown> }) {
  // Show fixes detail if present
  const fixes = result.fixes as CardScoreFix[] | undefined;

  return (
    <div className="mt-3 rounded-md bg-muted/50 p-3 text-sm space-y-1">
      {Object.entries(result)
        .filter(([k]) => k !== "fixes" && k !== "errors" && k !== "logs" && k !== "skipped")
        .map(([key, value]) => (
          <div key={key} className="flex justify-between">
            <span className="text-muted-foreground">{key}</span>
            <span className="font-mono">
              {typeof value === "number" ? value.toLocaleString() : String(value)}
            </span>
          </div>
        ))}
      {fixes && fixes.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground mb-1">
            Fixes ({fixes.length}):
          </p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {fixes.map((fix) => (
              <div key={fix.cardId} className="text-xs font-mono">
                {fix.cardId.slice(0, 8)}... {fix.oldScore}/{fix.oldTotal} →{" "}
                {fix.newScore}/{fix.newTotal}
              </div>
            ))}
          </div>
        </div>
      )}
      {Array.isArray(result.errors) && (result.errors as Array<{ userId: string; message: string }>).length > 0 && (
        <div className="mt-2 pt-2 border-t border-border">
          <p className="text-xs text-red-400 mb-1">
            Errors ({(result.errors as unknown[]).length}):
          </p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {(result.errors as Array<{ userId: string; message: string }>).map((e, i) => (
              <div key={i} className="text-xs font-mono text-red-400">
                {e.userId.slice(0, 8)}... {e.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DataResync() {
  const [reResolve, setReResolve] = useState<StepState>({ status: "idle" });
  const [cardScores, setCardScores] = useState<StepState>({ status: "idle" });
  const [leaderboard, setLeaderboard] = useState<StepState>({ status: "idle" });
  const [recap, setRecap] = useState<StepState>({ status: "idle" });
  const [fullResync, setFullResync] = useState<StepState>({ status: "idle" });

  const [leaderboardUserId, setLeaderboardUserId] = useState("");
  const [recapDate, setRecapDate] = useState("");

  // -----------------------------------------------------------------------
  // API callers
  // -----------------------------------------------------------------------

  const runStep = useCallback(
    async (
      url: string,
      body: Record<string, unknown> | null,
      setState: React.Dispatch<React.SetStateAction<StepState>>,
    ): Promise<Record<string, unknown> | null> => {
      setState({ status: "running" });
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        const data = await res.json();
        if (!res.ok) {
          setState({ status: "error", error: data.error ?? "Request failed" });
          return null;
        }
        setState({ status: "success", result: data });
        return data;
      } catch (err) {
        setState({
          status: "error",
          error: err instanceof Error ? err.message : "Network error",
        });
        return null;
      }
    },
    [],
  );

  const handleReResolve = useCallback(
    () => runStep("/api/admin/re-resolve", null, setReResolve),
    [runStep],
  );

  const handleCardScores = useCallback(
    () => runStep("/api/admin/resync/card-scores", null, setCardScores),
    [runStep],
  );

  const handleLeaderboard = useCallback(
    () =>
      runStep(
        "/api/admin/resync/leaderboard",
        leaderboardUserId ? { userId: leaderboardUserId } : {},
        setLeaderboard,
      ),
    [runStep, leaderboardUserId],
  );

  const handleRecap = useCallback(
    () => runStep("/api/admin/resync/recap", { date: recapDate }, setRecap),
    [runStep, recapDate],
  );

  const handleFullResync = useCallback(async () => {
    setFullResync({ status: "running" });
    try {
      // Step 1: Re-resolve
      const r1 = await runStep("/api/admin/re-resolve", null, setReResolve);
      if (!r1) {
        setFullResync({ status: "error", error: "Re-resolve failed" });
        return;
      }

      // Step 2: Card scores
      const r2 = await runStep(
        "/api/admin/resync/card-scores",
        null,
        setCardScores,
      );
      if (!r2) {
        setFullResync({ status: "error", error: "Card scores resync failed" });
        return;
      }

      // Step 3: Leaderboard (all users)
      const r3 = await runStep(
        "/api/admin/resync/leaderboard",
        {},
        setLeaderboard,
      );
      if (!r3) {
        setFullResync({ status: "error", error: "Leaderboard rebuild failed" });
        return;
      }

      const r1Typed = r1 as unknown as ReResolveResult;
      const r2Typed = r2 as unknown as CardScoresResult;
      const r3Typed = r3 as unknown as LeaderboardResult;

      const summary: FullResyncSummary = {
        picksUpdated: r1Typed.picksUpdated,
        cardsRescored: r1Typed.cardsRescored,
        cardsFixed: r2Typed.cardsFixed,
        usersProcessed: r3Typed.usersProcessed,
      };

      setFullResync({ status: "success", result: summary as unknown as Record<string, unknown> });
    } catch {
      setFullResync({ status: "error", error: "Full resync failed" });
    }
  }, [runStep]);

  const anyRunning =
    reResolve.status === "running" ||
    cardScores.status === "running" ||
    leaderboard.status === "running" ||
    recap.status === "running" ||
    fullResync.status === "running";

  const isRebuildAll = !leaderboardUserId;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="space-y-4">
      {/* Recommended order notice */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Recommended order</p>
        <ol className="list-decimal list-inside space-y-0.5">
          <li>Re-resolve stale picks (fix pick results from updated boxscores)</li>
          <li>Resync card scores (recalculate from corrected pick results)</li>
          <li>Rebuild leaderboard (recompute all derived stats)</li>
          <li>Recompute recap (regenerate daily summaries if needed)</li>
        </ol>
        <p className="mt-2">
          Or use <strong>Full Resync</strong> to run steps 1-3 sequentially.
        </p>
      </div>

      {/* Full Resync */}
      <Card className="border-primary/30 py-4">
        <CardHeader className="pb-0 pt-0 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Full Resync</CardTitle>
              <StatusIcon status={fullResync.status} />
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  disabled={anyRunning}
                >
                  {fullResync.status === "running" ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Running...
                    </>
                  ) : (
                    "Run All"
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Run Full Resync?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will re-resolve all picks, resync all card scores, and
                    rebuild every user&apos;s leaderboard stats. This operation may
                    take several minutes.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleFullResync}>
                    Run All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent className="px-4 pt-2 pb-0">
          <p className="text-sm text-muted-foreground">
            Chains re-resolve, card scores, and leaderboard rebuild sequentially.
          </p>
          {fullResync.error && (
            <p className="mt-2 text-sm text-red-400">{fullResync.error}</p>
          )}
          {fullResync.result && <ResultDisplay result={fullResync.result} />}
        </CardContent>
      </Card>

      {/* Step 1: Re-resolve */}
      <Card className="py-4">
        <CardHeader className="pb-0 pt-0 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Re-resolve Stale Picks</CardTitle>
              <Badge variant="outline" className="text-xs">Step 1</Badge>
              <StatusIcon status={reResolve.status} />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReResolve}
              disabled={anyRunning}
            >
              {reResolve.status === "running" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Run"
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pt-2 pb-0">
          <p className="text-sm text-muted-foreground">
            Re-evaluates picks with missing or incorrect results against current boxscores.
          </p>
          {reResolve.error && (
            <p className="mt-2 text-sm text-red-400">{reResolve.error}</p>
          )}
          {reResolve.result && <ResultDisplay result={reResolve.result} />}
        </CardContent>
      </Card>

      {/* Step 2: Card scores */}
      <Card className="py-4">
        <CardHeader className="pb-0 pt-0 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Resync Card Scores</CardTitle>
              <Badge variant="outline" className="text-xs">Step 2</Badge>
              <StatusIcon status={cardScores.status} />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCardScores}
              disabled={anyRunning}
            >
              {cardScores.status === "running" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Run"
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pt-2 pb-0">
          <p className="text-sm text-muted-foreground">
            Recalculates score and total_picks for every resolved card from actual pick
            results.
          </p>
          {cardScores.error && (
            <p className="mt-2 text-sm text-red-400">{cardScores.error}</p>
          )}
          {cardScores.result && <ResultDisplay result={cardScores.result} />}
        </CardContent>
      </Card>

      {/* Step 3: Leaderboard */}
      <Card className="py-4">
        <CardHeader className="pb-0 pt-0 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Rebuild Leaderboard</CardTitle>
              <Badge variant="outline" className="text-xs">Step 3</Badge>
              <StatusIcon status={leaderboard.status} />
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="User ID (optional)"
                value={leaderboardUserId}
                onChange={(e) => setLeaderboardUserId(e.target.value)}
                className="h-8 w-56 text-sm"
              />
              {isRebuildAll ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={anyRunning}
                    >
                      {leaderboard.status === "running" ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        "Rebuild All"
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Rebuild All Leaderboards?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will recompute streaks, win rates, and H2H stats for
                        every user with resolved cards. This may take a while.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleLeaderboard}>
                        Rebuild All
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLeaderboard}
                  disabled={anyRunning}
                >
                  {leaderboard.status === "running" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Rebuild User"
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pt-2 pb-0">
          <p className="text-sm text-muted-foreground">
            Recomputes streaks, win rate, and H2H stats from resolved cards and challenges.
            Enter a user ID for a single rebuild, or leave empty for all users.
          </p>
          {leaderboard.error && (
            <p className="mt-2 text-sm text-red-400">{leaderboard.error}</p>
          )}
          {leaderboard.result && <ResultDisplay result={leaderboard.result} />}
        </CardContent>
      </Card>

      {/* Step 4: Recap */}
      <Card className="py-4">
        <CardHeader className="pb-0 pt-0 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Recompute Recap</CardTitle>
              <Badge variant="outline" className="text-xs">Step 4</Badge>
              <StatusIcon status={recap.status} />
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={recapDate}
                onChange={(e) => setRecapDate(e.target.value)}
                className="h-8 w-40 text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleRecap}
                disabled={anyRunning || !recapDate}
              >
                {recap.status === "running" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Recompute"
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-4 pt-2 pb-0">
          <p className="text-sm text-muted-foreground">
            Recomputes the daily and weekly recap for the selected date from resolved cards.
          </p>
          {recap.error && (
            <p className="mt-2 text-sm text-red-400">{recap.error}</p>
          )}
          {recap.result && <ResultDisplay result={recap.result} />}
        </CardContent>
      </Card>
    </div>
  );
}

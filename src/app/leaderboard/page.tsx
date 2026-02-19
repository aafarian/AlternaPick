"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import LeaderboardTable from "@/components/leaderboard/LeaderboardTable";
import type {
  LeaderboardEntryWithProfile,
  LeaderboardResponse,
} from "@/app/api/leaderboard/route";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, useReducedMotion } from "@/lib/motion";
import { SlideUp, ScaleIn, FadeIn } from "@/components/motion";
import { AnimatedEmptyState } from "@/components/ui/animated-empty-state";
import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

type TabKey = "global" | "friends";
type SortKey = "hit_rate" | "h2h";

function isValidTab(v: string | null): v is TabKey {
  return v === "global" || v === "friends";
}
function isValidSort(v: string | null): v is SortKey {
  return v === "hit_rate" || v === "h2h";
}

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const prefersReduced = useReducedMotion();

  const tabParam = searchParams.get("tab");
  const sortParam = searchParams.get("sort");
  const activeTab: TabKey = isValidTab(tabParam) ? tabParam : "global";
  const sortBy: SortKey = isValidSort(sortParam) ? sortParam : "hit_rate";

  const updateParams = useCallback(
    (updates: { tab?: TabKey; sort?: SortKey }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (updates.tab !== undefined) params.set("tab", updates.tab);
      if (updates.sort !== undefined) params.set("sort", updates.sort);
      router.replace(`/leaderboard?${params.toString()}`);
    },
    [searchParams, router]
  );

  const [entries, setEntries] = useState<LeaderboardEntryWithProfile[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardResponse["userRank"]>(
    null
  );
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchLeaderboard(scope: TabKey, sort: SortKey) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/leaderboard?scope=${scope}&limit=50&offset=0&sort=${sort}`
      );
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Sign in to view the friends leaderboard.");
        }
        throw new Error("Failed to load leaderboard");
      }
      const data: LeaderboardResponse = await res.json();
      setEntries(data.entries);
      setUserRank(data.userRank);
      setTotal(data.total);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load leaderboard"
      );
      setEntries([]);
      setUserRank(null);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    fetchLeaderboard(activeTab, sortBy);
  }, [activeTab, sortBy, authLoading]);

  const handleTabChange = (value: string) => {
    const tab = value as TabKey;
    if (tab === "friends" && !user) return;
    updateParams({ tab });
  };

  if (authLoading) {
    return (
      <div className="flex flex-col gap-6 py-8">
        <AnimatedSkeleton count={1} variant="row" className="h-8 w-44" />
        <AnimatedSkeleton count={2} variant="row" className="h-9 w-24 rounded-lg" containerClassName="flex-row gap-2" />
        <AnimatedSkeleton count={5} variant="card" className="h-14 rounded-xl" />
      </div>
    );
  }

  const springTransition = prefersReduced
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 500, damping: 30 };

  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Header */}
      <SlideUp>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
          <p className="text-sm text-muted-foreground">
            {total} player{total !== 1 ? "s" : ""} ranked
          </p>
        </div>
      </SlideUp>

      {/* Tabs */}
      <FadeIn delay={0.1}>
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="bg-secondary">
            <TabsTrigger
              value="global"
              className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary"
            >
              Global
            </TabsTrigger>
            <TabsTrigger
              value="friends"
              disabled={!user}
              className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary"
            >
              Friends
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </FadeIn>

      {/* Sort toggle with layoutId active indicator */}
      <FadeIn delay={0.15}>
        <div className="flex items-center gap-1 rounded-lg bg-secondary p-1 w-fit relative">
          <button
            onClick={() => updateParams({ sort: "hit_rate" })}
            className={cn(
              "relative rounded-md px-3 py-1.5 text-xs font-semibold transition-colors z-10",
              sortBy === "hit_rate"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {sortBy === "hit_rate" && (
              <motion.div
                layoutId="leaderboard-sort-indicator"
                className="absolute inset-0 rounded-md bg-background shadow-sm"
                transition={springTransition}
              />
            )}
            <span className="relative z-10">Hit Rate</span>
          </button>
          <button
            onClick={() => updateParams({ sort: "h2h" })}
            className={cn(
              "relative rounded-md px-3 py-1.5 text-xs font-semibold transition-colors z-10",
              sortBy === "h2h"
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {sortBy === "h2h" && (
              <motion.div
                layoutId="leaderboard-sort-indicator"
                className="absolute inset-0 rounded-md bg-background shadow-sm"
                transition={springTransition}
              />
            )}
            <span className="relative z-10">H2H</span>
          </button>
        </div>
      </FadeIn>

      {/* Current User Rank Card */}
      {user && userRank && (
        <ScaleIn delay={0.2} initialScale={0.95}>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Your Rank
                  </p>
                  <motion.p
                    className="mt-1 text-3xl font-black text-primary"
                    initial={prefersReduced ? false : { scale: 1 }}
                    animate={
                      prefersReduced
                        ? undefined
                        : {
                            scale: [1, 1.08, 1],
                            textShadow: [
                              "0 0 0px hsl(var(--primary))",
                              "0 0 12px hsl(var(--primary))",
                              "0 0 0px hsl(var(--primary))",
                            ],
                          }
                    }
                    transition={
                      prefersReduced
                        ? { duration: 0 }
                        : { duration: 2, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }
                    }
                  >
                    #{userRank.rank}
                  </motion.p>
                </div>
                <div className="flex flex-wrap gap-4 sm:gap-6 sm:text-right">
                  {sortBy === "hit_rate" ? (
                    <>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hit Rate</p>
                        <p className="text-sm font-bold">
                          {userRank.stats.win_rate.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Streak</p>
                        <p className="text-sm font-bold">
                          {userRank.stats.current_streak}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cards</p>
                        <p className="text-sm font-bold">
                          {userRank.stats.total_cards}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">H2H</p>
                        <p className="text-sm font-bold">
                          {userRank.stats.h2h_wins}W-{userRank.stats.h2h_losses}L
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">H2H</p>
                        <p className="text-sm font-bold">
                          {userRank.stats.h2h_wins}W-{userRank.stats.h2h_losses}L
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Hit Rate</p>
                        <p className="text-sm font-bold">
                          {userRank.stats.win_rate.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Streak</p>
                        <p className="text-sm font-bold">
                          {userRank.stats.current_streak}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cards</p>
                        <p className="text-sm font-bold">
                          {userRank.stats.total_cards}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </ScaleIn>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center gap-2">
            {error}
            <Button
              variant="link"
              size="sm"
              onClick={() => fetchLeaderboard(activeTab, sortBy)}
              className="text-destructive underline"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading */}
      {loading && !error && (
        <AnimatedSkeleton count={5} variant="card" className="h-14 rounded-xl" />
      )}

      {/* Content */}
      {!loading && !error && entries.length > 0 && (
        <LeaderboardTable
          entries={entries}
          currentUserId={user?.id ?? null}
          sort={sortBy}
        />
      )}

      {/* Empty state */}
      {!loading && !error && entries.length === 0 && (
        <AnimatedEmptyState
          icon={activeTab === "global" ? <Trophy className="h-8 w-8" /> : <Users className="h-8 w-8" />}
          title={
            activeTab === "global"
              ? "No leaderboard entries yet"
              : "No friends ranked yet"
          }
          description={
            activeTab === "global"
              ? "Play some cards to get ranked!"
              : "None of your friends have played yet. Challenge them to get started!"
          }
        />
      )}
    </div>
  );
}

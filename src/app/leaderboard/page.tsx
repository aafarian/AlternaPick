"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import LeaderboardTable from "@/components/leaderboard/LeaderboardTable";
import type {
  LeaderboardEntryWithProfile,
  LeaderboardResponse,
} from "@/app/api/leaderboard/route";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

type TabKey = "global" | "friends";

export default function LeaderboardPage() {
  const { user, loading: authLoading } = useAuth();

  const [entries, setEntries] = useState<LeaderboardEntryWithProfile[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardResponse["userRank"]>(
    null
  );
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("global");
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(
    async (scope: TabKey) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/leaderboard?scope=${scope}&limit=50&offset=0`
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
    },
    []
  );

  useEffect(() => {
    if (authLoading) return;
    fetchLeaderboard(activeTab);
  }, [activeTab, authLoading, fetchLeaderboard]);

  const handleTabChange = (value: string) => {
    const tab = value as TabKey;
    if (tab === "friends" && !user) return;
    setActiveTab(tab);
  };

  if (authLoading) {
    return (
      <div className="flex flex-col gap-6 py-8">
        <Skeleton className="h-8 w-44" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-muted-foreground">
          {total} player{total !== 1 ? "s" : ""} ranked
        </p>
      </div>

      {/* Tabs */}
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

      {/* Current User Rank Card */}
      {user && userRank && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Your Rank
                </p>
                <p className="mt-1 text-3xl font-black text-primary">
                  #{userRank.rank}
                </p>
              </div>
              <div className="flex flex-wrap gap-4 sm:gap-6 sm:text-right">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Win Rate</p>
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
              </div>
            </div>
          </CardContent>
        </Card>
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
              onClick={() => fetchLeaderboard(activeTab)}
              className="text-destructive underline"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading */}
      {loading && !error && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      )}

      {/* Content */}
      {!loading && !error && entries.length > 0 && (
        <LeaderboardTable
          entries={entries}
          currentUserId={user?.id ?? null}
        />
      )}

      {/* Empty state */}
      {!loading && !error && entries.length === 0 && (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="text-3xl">
              {activeTab === "global" ? "\uD83C\uDFC6" : "\uD83D\uDC65"}
            </span>
            <p className="text-muted-foreground">
              {activeTab === "global"
                ? "No leaderboard entries yet. Play some cards to get ranked!"
                : "None of your friends have played yet. Challenge them to get started!"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

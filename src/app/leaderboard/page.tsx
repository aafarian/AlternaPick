"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import LeaderboardTable from "@/components/leaderboard/LeaderboardTable";
import type {
  LeaderboardEntryWithProfile,
  LeaderboardResponse,
} from "@/app/api/leaderboard/route";

type TabKey = "global" | "friends";

const TABS: { key: TabKey; label: string; requiresAuth: boolean }[] = [
  { key: "global", label: "Global", requiresAuth: false },
  { key: "friends", label: "Friends", requiresAuth: true },
];

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

  const handleTabChange = (tab: TabKey) => {
    if (tab === "friends" && !user) return;
    setActiveTab(tab);
  };

  // Loading skeleton during auth check
  if (authLoading) {
    return (
      <div className="flex flex-col gap-8 py-8">
        <div className="h-8 w-44 animate-pulse rounded-lg bg-surface" />
        <div className="flex gap-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-9 w-24 animate-pulse rounded-lg bg-surface"
            />
          ))}
        </div>
        <div className="h-16 animate-pulse rounded-2xl border border-border bg-surface" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-2xl border border-border bg-surface"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-sm text-muted">
          {total} player{total !== 1 ? "s" : ""} ranked
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map((tab) => {
          const disabled = tab.requiresAuth && !user;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              disabled={disabled}
              className={`min-h-[44px] rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-indigo-500 text-white"
                  : disabled
                    ? "cursor-not-allowed border border-border text-muted/50"
                    : "border border-border text-muted hover:bg-surface-hover hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Current User Rank Card */}
      {user && userRank && (
        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted">
                Your Rank
              </p>
              <p className="mt-1 text-2xl font-bold text-indigo-400">
                #{userRank.rank}
              </p>
            </div>
            <div className="flex flex-wrap gap-4 sm:gap-6 sm:text-right">
              <div>
                <p className="text-xs text-muted">Win Rate</p>
                <p className="text-sm font-semibold">
                  {(userRank.stats.win_rate * 100).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Streak</p>
                <p className="text-sm font-semibold">
                  {userRank.stats.current_streak}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">Cards</p>
                <p className="text-sm font-semibold">
                  {userRank.stats.total_cards}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted">H2H</p>
                <p className="text-sm font-semibold">
                  {userRank.stats.h2h_wins}W-{userRank.stats.h2h_losses}L
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-400">
          {error}
          <button
            onClick={() => fetchLeaderboard(activeTab)}
            className="ml-2 inline-flex min-h-[44px] items-center underline hover:text-red-300"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && !error && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-2xl border border-border bg-surface"
            />
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
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface py-12 text-center">
          <span className="text-3xl">
            {activeTab === "global" ? "\uD83C\uDFC6" : "\uD83D\uDC65"}
          </span>
          <p className="text-muted">
            {activeTab === "global"
              ? "No leaderboard entries yet. Play some cards to get ranked!"
              : "None of your friends have played yet. Challenge them to get started!"}
          </p>
        </div>
      )}
    </div>
  );
}

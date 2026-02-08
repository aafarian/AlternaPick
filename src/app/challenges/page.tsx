"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { createClient } from "@/lib/supabase/client";
import ChallengeCard from "@/components/challenges/ChallengeCard";
import CreateChallengeModal from "@/components/challenges/CreateChallengeModal";
import type { ChallengeWithProfiles } from "@/lib/challenges/queries";

type TabKey = "active" | "pending" | "sent" | "history";

const TABS: { key: TabKey; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "pending", label: "Pending" },
  { key: "sent", label: "Sent" },
  { key: "history", label: "History" },
];

export default function ChallengesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [challenges, setChallenges] = useState<ChallengeWithProfiles[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("active");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set of challenge IDs for which the current user already has a card */
  const [userCardChallengeIds, setUserCardChallengeIds] = useState<Set<string>>(
    new Set()
  );

  const fetchChallenges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/challenges");
      if (!res.ok) throw new Error("Failed to load challenges");
      const data = await res.json();
      const fetched: ChallengeWithProfiles[] = data.challenges ?? [];
      setChallenges(fetched);

      // Fetch the user's challenge-linked cards so we know which ones already have picks
      if (user) {
        const challengeIds = fetched
          .filter((c) => c.status === "accepted" || c.status === "active")
          .map((c) => c.id);

        if (challengeIds.length > 0) {
          const supabase = createClient();
          const { data: userCards } = await (supabase.from("cards") as any)
            .select("challenge_id")
            .eq("user_id", user.id)
            .in("challenge_id", challengeIds);

          const ids = new Set<string>(
            ((userCards ?? []) as Array<{ challenge_id: string }>).map(
              (c) => c.challenge_id
            )
          );
          setUserCardChallengeIds(ids);
        } else {
          setUserCardChallengeIds(new Set());
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load challenges"
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth/login?redirectTo=/challenges");
      return;
    }
    fetchChallenges();
  }, [user, authLoading, router, fetchChallenges]);

  const handleAction = async (
    challengeId: string,
    action: "accept" | "decline" | "cancel"
  ) => {
    setActionLoading(challengeId);
    try {
      const res = await fetch(`/api/challenges/${challengeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `Failed to ${action} challenge`);
      }
      // Refresh the list
      await fetchChallenges();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to ${action} challenge`
      );
    } finally {
      setActionLoading(null);
    }
  };

  // Categorize challenges
  const userId = user?.id ?? "";

  const activeChallenges = challenges.filter(
    (c) => c.status === "accepted" || c.status === "active"
  );

  const pendingReceived = challenges.filter(
    (c) => c.status === "pending" && c.opponent_id === userId
  );

  const pendingSent = challenges.filter(
    (c) => c.status === "pending" && c.challenger_id === userId
  );

  const historyChallenges = challenges.filter(
    (c) =>
      c.status === "resolved" ||
      c.status === "declined" ||
      c.status === "cancelled"
  );

  const tabData: Record<TabKey, ChallengeWithProfiles[]> = {
    active: activeChallenges,
    pending: pendingReceived,
    sent: pendingSent,
    history: historyChallenges,
  };

  const tabCounts: Record<TabKey, number> = {
    active: activeChallenges.length,
    pending: pendingReceived.length,
    sent: pendingSent.length,
    history: historyChallenges.length,
  };

  const currentChallenges = tabData[activeTab];

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex flex-col gap-8 py-8">
        <div className="h-8 w-44 animate-pulse rounded-lg bg-surface" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-9 w-24 animate-pulse rounded-lg bg-surface"
            />
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-2xl border border-border bg-surface"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Challenges</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-600"
        >
          New Challenge
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-red-300 hover:text-red-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-indigo-500 text-white"
                : "border border-border text-muted hover:bg-surface-hover hover:text-foreground"
            }`}
          >
            {tab.label}
            {tabCounts[tab.key] > 0 && (
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${
                  activeTab === tab.key
                    ? "bg-white/20"
                    : "bg-muted/20"
                }`}
              >
                {tabCounts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl border border-border bg-surface"
            />
          ))}
        </div>
      ) : currentChallenges.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface py-12 text-center">
          <span className="text-3xl">
            {activeTab === "active" && "\u2694\uFE0F"}
            {activeTab === "pending" && "\uD83D\uDCE8"}
            {activeTab === "sent" && "\uD83D\uDCE4"}
            {activeTab === "history" && "\uD83D\uDCDC"}
          </span>
          <p className="text-muted">
            {activeTab === "active" && "No active challenges"}
            {activeTab === "pending" && "No pending challenges"}
            {activeTab === "sent" && "No sent challenges"}
            {activeTab === "history" && "No challenge history yet"}
          </p>
          {(activeTab === "active" || activeTab === "sent") && (
            <button
              onClick={() => setModalOpen(true)}
              className="text-sm text-indigo-400 hover:text-indigo-300"
            >
              Challenge a friend!
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {currentChallenges.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              currentUserId={userId}
              onAccept={(id) => handleAction(id, "accept")}
              onDecline={(id) => handleAction(id, "decline")}
              onCancel={(id) => handleAction(id, "cancel")}
              actionLoading={actionLoading}
              userHasCard={userCardChallengeIds.has(challenge.id)}
            />
          ))}
        </div>
      )}

      {/* Create Challenge Modal */}
      <CreateChallengeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={fetchChallenges}
      />
    </div>
  );
}

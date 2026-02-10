"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { createClient } from "@/lib/supabase/client";
import ChallengeCard from "@/components/challenges/ChallengeCard";
import CreateChallengeModal from "@/components/challenges/CreateChallengeModal";
import type { ChallengeWithProfiles } from "@/lib/challenges/queries";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, AlertCircle } from "lucide-react";

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
      await fetchChallenges();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to ${action} challenge`
      );
    } finally {
      setActionLoading(null);
    }
  };

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
      <div className="flex flex-col gap-6 py-8">
        <Skeleton className="h-8 w-44" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-lg" />
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Challenges</h1>
        <Button onClick={() => setModalOpen(true)} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          New Challenge
        </Button>
      </div>

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button
              variant="link"
              size="sm"
              onClick={() => setError(null)}
              className="ml-2 text-destructive underline"
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList className="bg-secondary">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="gap-1.5 data-[state=active]:bg-primary/15 data-[state=active]:text-primary"
            >
              {tab.label}
              {tabCounts[tab.key] > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
                  {tabCounts[tab.key]}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : currentChallenges.length === 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="text-3xl">
              {activeTab === "active" && "\u2694\uFE0F"}
              {activeTab === "pending" && "\uD83D\uDCE8"}
              {activeTab === "sent" && "\uD83D\uDCE4"}
              {activeTab === "history" && "\uD83D\uDCDC"}
            </span>
            <p className="text-muted-foreground">
              {activeTab === "active" && "No active challenges"}
              {activeTab === "pending" && "No pending challenges"}
              {activeTab === "sent" && "No sent challenges"}
              {activeTab === "history" && "No challenge history yet"}
            </p>
            {(activeTab === "active" || activeTab === "sent") && (
              <Button
                variant="link"
                onClick={() => setModalOpen(true)}
                className="text-primary"
              >
                Challenge a friend!
              </Button>
            )}
          </CardContent>
        </Card>
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

      <CreateChallengeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={fetchChallenges}
      />
    </div>
  );
}

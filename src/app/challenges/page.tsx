"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import ChallengeCard from "@/components/challenges/ChallengeCard";
import CreateChallengeModal from "@/components/challenges/CreateChallengeModal";
import type { ChallengeWithProfiles } from "@/lib/challenges/queries";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, AlertCircle, Loader2, Search, X, Inbox, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, useReducedMotion } from "@/lib/motion";
import { SlideUp, FadeIn, StaggerChildren, StaggerItem } from "@/components/motion";
import { AnimatedEmptyState } from "@/components/ui/animated-empty-state";
import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

type Tab = "feed" | "inbox" | "sent";

const TABS: { key: Tab; label: string }[] = [
  { key: "feed", label: "Feed" },
  { key: "inbox", label: "Inbox" },
  { key: "sent", label: "Sent" },
];

const COMPLETED_PAGE_SIZE = 15;

export default function ChallengesPage() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Core challenges (pending + active — always fully loaded)
  const [coreChallenges, setCoreChallenges] = useState<ChallengeWithProfiles[]>([]);
  // Completed challenges (paginated)
  const [completedChallenges, setCompletedChallenges] = useState<ChallengeWithProfiles[]>([]);
  const [hasMoreCompleted, setHasMoreCompleted] = useState(false);
  const [loadingMoreCompleted, setLoadingMoreCompleted] = useState(false);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("feed");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [userCardChallengeIds, setUserCardChallengeIds] = useState<Set<string>>(
    new Set()
  );

  const prefersReduced = useReducedMotion();

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Rematch: auto-open modal with pre-filled opponent from URL params.
  // Capture values in a ref so they survive the URL cleanup below.
  const initialOpponentRef = useRef<string | null>(null);
  const initialModeRef = useRef<string | null>(null);

  useEffect(() => {
    const opponent = searchParams.get("opponent");
    const mode = searchParams.get("mode");
    if (searchParams.get("create") === "true" || opponent) {
      if (opponent) initialOpponentRef.current = opponent;
      if (mode) initialModeRef.current = mode;
      setModalOpen(true);
      router.replace("/challenges", { scroll: false });
    }
  }, [searchParams, router]);

  // Fetch core challenges (pending + active)
  const fetchCore = useCallback(async () => {
    const res = await fetch("/api/challenges?status=pending,accepted,active");
    if (!res.ok) throw new Error("Failed to load challenges");
    const data = await res.json();
    setCoreChallenges(data.challenges ?? []);

    const cardIds: string[] = data.userCardChallengeIds ?? [];
    setUserCardChallengeIds(new Set(cardIds));
  }, []);

  // Fetch completed challenges (paginated)
  const fetchCompleted = useCallback(async (offset: number, append: boolean) => {
    const res = await fetch(
      `/api/challenges?status=resolved,declined,cancelled&limit=${COMPLETED_PAGE_SIZE}&offset=${offset}`
    );
    if (!res.ok) throw new Error("Failed to load challenges");
    const data = await res.json();
    const fetched: ChallengeWithProfiles[] = data.challenges ?? [];

    if (append) {
      setCompletedChallenges((prev) => [...prev, ...fetched]);
    } else {
      setCompletedChallenges(fetched);
    }
    setHasMoreCompleted(data.hasMore ?? false);
  }, []);

  // Initial load
  useEffect(() => {
    if (authLoading || !user) return;

    setLoading(true);
    setError(null);

    Promise.all([fetchCore(), fetchCompleted(0, false)])
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load challenges");
      })
      .finally(() => setLoading(false));
  }, [user, authLoading, fetchCore, fetchCompleted]);

  // Load more completed challenges
  const loadMore = useCallback(async () => {
    if (loadingMoreCompleted || !hasMoreCompleted) return;
    setLoadingMoreCompleted(true);
    try {
      await fetchCompleted(completedChallenges.length, true);
    } catch {
      // Silently fail — user can scroll again
    } finally {
      setLoadingMoreCompleted(false);
    }
  }, [loadingMoreCompleted, hasMoreCompleted, completedChallenges.length, fetchCompleted]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (activeTab !== "feed" || !hasMoreCompleted) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTab, hasMoreCompleted, loadMore]);

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

      // After accepting, navigate to the right page based on game mode
      if (action === "accept") {
        const accepted = coreChallenges.find((c) => c.id === challengeId);
        const mode = accepted?.game_mode;
        if (mode === "mirror" || mode === "random") {
          router.push(`/challenges/${challengeId}/ballot`);
        } else {
          router.push(`/props?challenge_id=${challengeId}`);
        }
        return;
      }

      // Refresh both sets
      await Promise.all([fetchCore(), fetchCompleted(0, false)]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to ${action} challenge`
      );
    } finally {
      setActionLoading(null);
    }
  };

  const userId = user?.id ?? "";

  // Segment core challenges
  const inboxChallenges = coreChallenges.filter(
    (c) => c.status === "pending" && c.opponent_id === userId
  );
  const sentChallenges = coreChallenges.filter(
    (c) => c.status === "pending" && c.challenger_id === userId
  );
  const activeChallenges = coreChallenges
    .filter((c) => c.status === "accepted" || c.status === "active")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Search filter helper
  const sq = searchQuery.trim().toLowerCase();
  const matchesSearch = (c: ChallengeWithProfiles) => {
    if (!sq) return true;
    const opp = c.challenger_id === userId ? c.opponent : c.challenger;
    const name = (opp.display_name || opp.username).toLowerCase();
    return name.includes(sq);
  };

  const filteredActive = activeChallenges.filter(matchesSearch);
  const filteredCompleted = completedChallenges.filter(matchesSearch);
  const filteredInbox = inboxChallenges.filter(matchesSearch);
  const filteredSent = sentChallenges.filter(matchesSearch);

  const feedEmpty = filteredActive.length === 0 && filteredCompleted.length === 0;
  const inboxCount = inboxChallenges.length;
  const sentCount = sentChallenges.length;

  if (authLoading) {
    return (
      <div className="flex flex-col gap-6 py-8">
        <AnimatedSkeleton count={1} className="h-8 w-44" variant="row" />
        <AnimatedSkeleton count={1} className="h-9 w-64 rounded-lg" variant="row" />
        <AnimatedSkeleton count={3} className="h-16" variant="card" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Challenges</h1>
        <p className="text-sm text-muted-foreground">Sign in to challenge your friends</p>
        <Button onClick={() => router.push("/auth/login?redirectTo=/challenges")}>
          Sign In
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 py-8">
      {/* Header */}
      <SlideUp>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Challenges</h1>
          <Button onClick={() => setModalOpen(true)} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            New Challenge
          </Button>
        </div>
      </SlideUp>

      {/* Search */}
      <FadeIn delay={0.15}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search opponents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-secondary/50 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </FadeIn>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: prefersReduced ? 0 : 0.25 }}
          >
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <FadeIn delay={0.2}>
        <div className="flex items-center gap-1 rounded-lg bg-secondary/50 p-1">
          {TABS.map((tab) => {
            const count = tab.key === "inbox" ? inboxCount : tab.key === "sent" ? sentCount : 0;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="challenge-tab-indicator"
                    className="absolute inset-0 rounded-md bg-background shadow-sm"
                    transition={{
                      type: "spring",
                      bounce: 0.2,
                      duration: prefersReduced ? 0 : 0.4,
                    }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
                {count > 0 && (
                  <Badge
                    className={cn(
                      "relative z-10 h-4.5 min-w-4.5 px-1.5 text-[10px]",
                      tab.key === "inbox"
                        ? "bg-amber-500 text-white"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </FadeIn>

      {/* Tab content */}
      {loading ? (
        <AnimatedSkeleton count={3} className="h-16" variant="card" />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReduced ? 0 : 0.2 }}
          >
            {activeTab === "feed" ? (
              feedEmpty ? (
                <AnimatedEmptyState
                  icon={<Inbox className="h-8 w-8" />}
                  title="No challenges yet"
                  action={
                    <Button
                      variant="link"
                      onClick={() => setModalOpen(true)}
                      className="text-primary"
                    >
                      Challenge a friend!
                    </Button>
                  }
                />
              ) : (
                <div className="flex flex-col gap-5">
                  {/* Active section */}
                  {filteredActive.length > 0 && (
                    <FadeIn>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                          <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            Active
                          </h3>
                        </div>
                        <StaggerChildren staggerDelay={0.06} className="flex flex-col gap-2">
                          {filteredActive.map((challenge) => (
                            <StaggerItem key={challenge.id}>
                              <ChallengeCard
                                challenge={challenge}
                                currentUserId={userId}
                                onAccept={(id) => handleAction(id, "accept")}
                                onDecline={(id) => handleAction(id, "decline")}
                                onCancel={(id) => handleAction(id, "cancel")}
                                actionLoading={actionLoading}
                                userHasCard={userCardChallengeIds.has(challenge.id)}
                              />
                            </StaggerItem>
                          ))}
                        </StaggerChildren>
                      </div>
                    </FadeIn>
                  )}

                  {/* Completed section */}
                  {filteredCompleted.length > 0 && (
                    <FadeIn delay={filteredActive.length > 0 ? 0.15 : 0}>
                      <div className="flex flex-col gap-2">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                          Completed
                        </h3>
                        <StaggerChildren staggerDelay={0.06} className="flex flex-col gap-2">
                          {filteredCompleted.map((challenge) => (
                            <StaggerItem key={challenge.id}>
                              <ChallengeCard
                                challenge={challenge}
                                currentUserId={userId}
                                onAccept={(id) => handleAction(id, "accept")}
                                onDecline={(id) => handleAction(id, "decline")}
                                onCancel={(id) => handleAction(id, "cancel")}
                                actionLoading={actionLoading}
                                userHasCard={userCardChallengeIds.has(challenge.id)}
                              />
                            </StaggerItem>
                          ))}
                        </StaggerChildren>

                        {/* Infinite scroll sentinel */}
                        {hasMoreCompleted && (
                          <div ref={sentinelRef} className="flex justify-center py-4">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        )}
                      </div>
                    </FadeIn>
                  )}
                </div>
              )
            ) : activeTab === "inbox" ? (
              filteredInbox.length === 0 ? (
                <AnimatedEmptyState
                  icon={<Inbox className="h-8 w-8" />}
                  title="No incoming challenges"
                  description="When someone challenges you, it'll show up here"
                />
              ) : (
                <StaggerChildren staggerDelay={0.06} className="flex flex-col gap-2">
                  {filteredInbox.map((challenge) => (
                    <StaggerItem key={challenge.id}>
                      <ChallengeCard
                        challenge={challenge}
                        currentUserId={userId}
                        onAccept={(id) => handleAction(id, "accept")}
                        onDecline={(id) => handleAction(id, "decline")}
                        onCancel={(id) => handleAction(id, "cancel")}
                        actionLoading={actionLoading}
                        userHasCard={userCardChallengeIds.has(challenge.id)}
                      />
                    </StaggerItem>
                  ))}
                </StaggerChildren>
              )
            ) : (
              filteredSent.length === 0 ? (
                <AnimatedEmptyState
                  icon={<Send className="h-8 w-8" />}
                  title="No pending sent challenges"
                  action={
                    <Button
                      variant="link"
                      onClick={() => setModalOpen(true)}
                      className="text-primary"
                    >
                      Challenge a friend!
                    </Button>
                  }
                />
              ) : (
                <StaggerChildren staggerDelay={0.06} className="flex flex-col gap-2">
                  {filteredSent.map((challenge) => (
                    <StaggerItem key={challenge.id}>
                      <ChallengeCard
                        challenge={challenge}
                        currentUserId={userId}
                        onAccept={(id) => handleAction(id, "accept")}
                        onDecline={(id) => handleAction(id, "decline")}
                        onCancel={(id) => handleAction(id, "cancel")}
                        actionLoading={actionLoading}
                        userHasCard={userCardChallengeIds.has(challenge.id)}
                      />
                    </StaggerItem>
                  ))}
                </StaggerChildren>
              )
            )}
          </motion.div>
        </AnimatePresence>
      )}

      <CreateChallengeModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          initialOpponentRef.current = null;
          initialModeRef.current = null;
        }}
        onCreated={() => {
          fetchCore();
          fetchCompleted(0, false);
        }}
        initialOpponentId={initialOpponentRef.current}
        initialMode={initialModeRef.current}
      />
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useRouter } from "next/navigation";
import UserSearchBar from "@/components/friends/UserSearchBar";
import FriendRequestCard from "@/components/friends/FriendRequestCard";
import type { FriendRequest } from "@/components/friends/FriendRequestCard";
import FriendsStrip from "@/components/friends/FriendsStrip";
import ActivityFeed from "@/components/activity/ActivityFeed";
import type { ActivityItem } from "@/app/api/activity/route";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function FriendsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [friends, setFriends] = useState<FriendRequest[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Activity feed state
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoadingData(true);
    setError(null);
    try {
      const [friendsRes, pendingRes] = await Promise.all([
        fetch("/api/friends?status=accepted"),
        fetch("/api/friends?status=pending"),
      ]);

      if (!friendsRes.ok || !pendingRes.ok) {
        throw new Error("Failed to load friends data");
      }

      const friendsData = await friendsRes.json();
      const pendingData = await pendingRes.json();

      setFriends(friendsData.friends ?? []);
      setPendingRequests(pendingData.friends ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoadingData(false);
    }
  }, []);

  const fetchActivity = useCallback(async () => {
    setActivityLoading(true);
    setActivityError(null);
    try {
      const res = await fetch("/api/activity");
      if (!res.ok) throw new Error("Failed to load activity feed");
      const data = await res.json();
      setActivityItems(data.items ?? []);
    } catch (err) {
      setActivityError(
        err instanceof Error ? err.message : "Failed to load activity feed"
      );
    } finally {
      setActivityLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login?redirectTo=/friends");
      return;
    }
    if (user) {
      fetchData();
      fetchActivity();
    }
  }, [user, authLoading, router, fetchData, fetchActivity]);

  const handleAccept = async (id: string) => {
    const res = await fetch(`/api/friends/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Failed to accept request");
    }

    const accepted = pendingRequests.find((r) => r.id === id);
    if (accepted) {
      setPendingRequests((prev) => prev.filter((r) => r.id !== id));
      setFriends((prev) => [
        { ...accepted, status: "accepted" },
        ...prev,
      ]);
    }
  };

  const handleDecline = async (id: string) => {
    const res = await fetch(`/api/friends/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "decline" }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Failed to decline request");
    }

    setPendingRequests((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUnfriend = async (id: string) => {
    const res = await fetch(`/api/friends/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Failed to remove friend");
    }

    setFriends((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSendRequest = async (username: string) => {
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addressee_username: username }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Failed to send friend request");
    }
  };

  if (authLoading || (!user && !error)) {
    return (
      <div className="flex flex-col gap-6 py-8">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-16 shrink-0 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-4 w-28" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Friends</h1>
        <p className="text-sm text-muted-foreground">
          {friends.length} friend{friends.length !== 1 ? "s" : ""}
          {pendingRequests.length > 0 &&
            ` \u00B7 ${pendingRequests.length} pending`}
        </p>
      </div>

      {/* Search */}
      <UserSearchBar onSendRequest={handleSendRequest} />

      {/* Error state */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button
              variant="link"
              size="sm"
              onClick={fetchData}
              className="ml-2 text-destructive underline"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Pending Requests
          </h2>
          {pendingRequests.map((request) => (
            <FriendRequestCard
              key={request.id}
              request={request}
              onAccept={handleAccept}
              onDecline={handleDecline}
            />
          ))}
        </section>
      )}

      {/* Friends Strip */}
      {!loadingData && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Your Friends
          </h2>
          <FriendsStrip friends={friends} onUnfriend={handleUnfriend} />
        </section>
      )}

      {loadingData && (
        <div className="flex gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex w-16 shrink-0 flex-col items-center gap-1.5">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-3 w-10" />
            </div>
          ))}
        </div>
      )}

      <Separator className="opacity-40" />

      {/* Activity Feed */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recent Activity
        </h2>

        {activityError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {activityError}
              <Button
                variant="link"
                size="sm"
                onClick={fetchActivity}
                className="ml-2 text-destructive underline"
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {activityLoading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        )}

        {!activityLoading && !activityError && (
          <ActivityFeed items={activityItems} />
        )}
      </section>
    </div>
  );
}

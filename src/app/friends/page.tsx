"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useRouter } from "next/navigation";
import UserSearchBar from "@/components/friends/UserSearchBar";
import FriendRequestCard from "@/components/friends/FriendRequestCard";
import type { FriendRequest } from "@/components/friends/FriendRequestCard";
import FriendsList from "@/components/friends/FriendsList";

export default function FriendsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [friends, setFriends] = useState<FriendRequest[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login?redirectTo=/friends");
      return;
    }
    if (user) {
      fetchData();
    }
  }, [user, authLoading, router, fetchData]);

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

    // Move from pending to friends list optimistically
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
      <div className="flex flex-col gap-8 py-8">
        <div className="h-8 w-36 animate-pulse rounded-lg bg-surface" />
        <div className="h-12 w-full animate-pulse rounded-2xl bg-surface" />
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
    <div className="flex flex-col gap-8 py-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Friends</h1>
        <p className="text-sm text-muted">
          {friends.length} friend{friends.length !== 1 ? "s" : ""}
          {pendingRequests.length > 0 &&
            ` \u00B7 ${pendingRequests.length} pending request${pendingRequests.length !== 1 ? "s" : ""}`}
        </p>
      </div>

      {/* Search */}
      <section>
        <UserSearchBar onSendRequest={handleSendRequest} />
      </section>

      {/* Error state */}
      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-400">
          {error}
          <button
            onClick={fetchData}
            className="ml-2 underline hover:text-red-300"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loadingData && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl border border-border bg-surface"
            />
          ))}
        </div>
      )}

      {!loadingData && !error && (
        <>
          {/* Pending Requests */}
          {pendingRequests.length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-semibold">
                Pending Requests ({pendingRequests.length})
              </h2>
              <div className="flex flex-col gap-3">
                {pendingRequests.map((request) => (
                  <FriendRequestCard
                    key={request.id}
                    request={request}
                    onAccept={handleAccept}
                    onDecline={handleDecline}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Friends List */}
          <section>
            <h2 className="mb-4 text-lg font-semibold">Your Friends</h2>
            <FriendsList friends={friends} onUnfriend={handleUnfriend} />
          </section>
        </>
      )}
    </div>
  );
}

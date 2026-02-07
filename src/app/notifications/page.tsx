"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import NotificationList from "@/components/notifications/NotificationList";
import type { Notification } from "@/lib/supabase/types";

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/notifications?type=list");
      if (!res.ok) throw new Error("Failed to load notifications");
      const data = await res.json();
      setNotifications(data.notifications ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load notifications"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth/login?redirectTo=/notifications");
      return;
    }
    fetchNotifications();
  }, [user, authLoading, router, fetchNotifications]);

  const handleMarkRead = useCallback(
    async (notificationId: string) => {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );

      try {
        const res = await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notification_id: notificationId }),
        });
        if (!res.ok) {
          // Revert on failure
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === notificationId ? { ...n, read: false } : n
            )
          );
        }
      } catch {
        // Revert on failure
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, read: false } : n
          )
        );
      }
    },
    []
  );

  const handleMarkAllRead = useCallback(async () => {
    setMarkingAll(true);
    const prevNotifications = notifications;

    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all: true }),
      });
      if (!res.ok) {
        setNotifications(prevNotifications);
      }
    } catch {
      setNotifications(prevNotifications);
    } finally {
      setMarkingAll(false);
    }
  }, [notifications]);

  const handleNavigate = useCallback(
    (notification: Notification) => {
      const meta = notification.metadata as Record<string, unknown> | null;

      if (meta?.card_id) {
        router.push("/cards");
        return;
      }
      if (meta?.challenge_id) {
        router.push(`/challenges/${meta.challenge_id}`);
        return;
      }
      if (
        notification.type === "friend_request" ||
        notification.type === "friend_accepted"
      ) {
        router.push("/friends");
        return;
      }
    },
    [router]
  );

  const hasUnread = notifications.some((n) => !n.read);

  // Auth loading / redirect state
  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex flex-col gap-8 py-8">
        <div className="h-8 w-52 animate-pulse rounded-lg bg-surface" />
        <div className="h-4 w-64 animate-pulse rounded-lg bg-surface" />
        {[1, 2, 3, 4].map((i) => (
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted">
            Stay up to date with your picks and challenges
          </p>
        </div>

        {hasUnread && !loading && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="shrink-0 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
          >
            {markingAll ? "Marking..." : "Mark all as read"}
          </button>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center text-sm text-red-400">
          {error}
          <button
            onClick={fetchNotifications}
            className="ml-2 underline hover:text-red-300"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && !error && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-2xl border border-border bg-surface"
            />
          ))}
        </div>
      )}

      {/* Notifications list */}
      {!loading && !error && (
        <NotificationList
          notifications={notifications}
          onMarkRead={handleMarkRead}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  );
}

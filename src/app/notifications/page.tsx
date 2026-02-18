"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import NotificationList from "@/components/notifications/NotificationList";
import type { Notification } from "@/lib/supabase/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { SlideUp, FadeIn } from "@/components/motion";
import { AnimatePresence, motion } from "@/lib/motion";
import { AnimatedSkeleton } from "@/components/ui/animated-skeleton";

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
        const res = await fetch(`/api/notifications/${notificationId}`, {
          method: "PATCH",
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
        body: JSON.stringify({ action: "mark_all_read" }),
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
        router.push("/picks");
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
        <AnimatedSkeleton count={1} variant="row" className="h-8 w-52" />
        <AnimatedSkeleton count={1} variant="row" className="h-4 w-64" />
        <AnimatedSkeleton count={4} variant="card" className="h-20 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      {/* Header */}
      <SlideUp>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
            <p className="text-sm text-muted-foreground">
              Stay up to date with your picks and challenges
            </p>
          </div>

          <AnimatePresence>
            {hasUnread && !loading && (
              <motion.div
                key="mark-all-read"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleMarkAllRead}
                  disabled={markingAll}
                >
                  {markingAll ? "Marking..." : "Mark all read"}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SlideUp>

      {/* Error state */}
      <AnimatePresence>
        {error && (
          <motion.div
            key="error-alert"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
                <Button
                  variant="link"
                  size="sm"
                  onClick={fetchNotifications}
                  className="ml-2 text-destructive underline"
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state */}
      {loading && !error && (
        <AnimatedSkeleton count={4} variant="card" className="h-20 rounded-xl" />
      )}

      {/* Notifications list */}
      {!loading && !error && (
        <FadeIn delay={0.1}>
          <NotificationList
            notifications={notifications}
            onMarkRead={handleMarkRead}
            onNavigate={handleNavigate}
          />
        </FadeIn>
      )}
    </div>
  );
}

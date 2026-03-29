"use client";

import Link from "next/link";
import Nav from "./Nav";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import NotificationBell from "./NotificationBell";
import StreakBadge from "./StreakBadge";
import { POLL_INTERVAL_MS, MAX_VISIBLE_TOASTS, getNotificationIcon, getNotificationTitle } from "@/lib/constants";
import { getNavigationPath } from "@/lib/notifications/utils";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import type { NotificationCounts } from "./Nav";
import type { Notification } from "@/lib/supabase/types";

export default function Header() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { user, loading, supabase } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [notificationCounts, setNotificationCounts] =
    useState<NotificationCounts>({ friends: 0, challenges: 0, notifications: 0 });
  const [isAdminUser, setIsAdminUser] = useState(false);

  // Callback registered by NotificationBell to prepend a new notification
  const prependNotificationRef = useRef<((n: Notification) => void) | null>(null);

  // Dedup set so the same notification is never toasted twice
  // (covers overlap between realtime delivery and reconnection catch-up)
  const toastedIdsRef = useRef<Set<string>>(new Set());

  const showNotificationToast = useCallback(
    (n: Notification) => {
      if (toastedIdsRef.current.has(n.id)) return;
      toastedIdsRef.current.add(n.id);

      const icon = getNotificationIcon(n.type);
      const title = getNotificationTitle(n.type, n.title, n.body);
      const path = getNavigationPath(n);

      toast.custom(
        (id) => (
          <button
            type="button"
            onClick={() => {
              toast.dismiss(id);
              if (path) router.push(path);
            }}
            className="flex w-full items-start gap-3 rounded-lg border border-border bg-card p-3 text-left shadow-lg transition-colors hover:bg-secondary/50"
          >
            <span className="mt-0.5 text-base leading-none">{icon}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{title}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{n.body}</p>
            </div>
          </button>
        ),
        { duration: 5000 }
      );
    },
    [router]
  );

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotificationCounts({
        friends: data.pendingFriendRequests ?? 0,
        challenges: data.pendingChallenges ?? 0,
        notifications: data.unreadNotifications ?? 0,
      });
    } catch {
      // Silently ignore fetch errors for notification counts
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setNotificationCounts({ friends: 0, challenges: 0, notifications: 0 });
      toastedIdsRef.current.clear();
      setIsAdminUser(false);
      return;
    }
    fetchCounts();
  }, [user, pathname, fetchCounts]);

  // Check admin status when user changes (not on every pathname change)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/check");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setIsAdminUser(data.isAdmin === true);
      } catch {
        // Silently ignore - admin link just won't show
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(fetchCounts, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, fetchCounts]);

  // Supabase Realtime subscription with automatic reconnection.
  // On reconnect, catches up on any notifications missed while disconnected.
  useEffect(() => {
    if (!user || !supabase) return;

    let retryTimeout: ReturnType<typeof setTimeout>;
    let retryCount = 0;
    let channelRef: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    const MAX_RETRIES = 10;

    // Timestamp of the last successfully received realtime event.
    // Used after reconnection to fetch anything we missed.
    let lastEventAt = new Date().toISOString();

    async function catchUpMissedNotifications() {
      try {
        const res = await fetch(
          `/api/notifications?type=list&limit=10`
        );
        if (!res.ok) return;
        const data = await res.json();
        const notifications = (data.notifications ?? []) as Notification[];
        const missed = notifications.filter(
          (n) => !n.read && new Date(n.created_at).getTime() >= new Date(lastEventAt).getTime()
        );

        // Prepend all missed notifications into the bell dropdown
        for (const n of missed) {
          prependNotificationRef.current?.(n);
        }

        // Filter out already-toasted IDs so reconnects don't re-fire
        const untoasted = missed.filter((n) => !toastedIdsRef.current.has(n.id));
        if (untoasted.length === 0) {
          fetchCounts();
          return;
        }

        // Avoid toast storm: if too many missed, show a single summary toast
        if (untoasted.length > MAX_VISIBLE_TOASTS) {
          toast(`You have ${untoasted.length} new notifications`, { duration: 5000 });
          for (const n of untoasted) {
            toastedIdsRef.current.add(n.id);
          }
        } else {
          for (const n of untoasted) {
            showNotificationToast(n);
          }
        }

        // Also refresh counts
        fetchCounts();
      } catch {
        // Non-fatal
      }
    }

    function subscribe() {
      if (cancelled) return;

      const channel = supabase
        .channel(`notifications-realtime-${Date.now()}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user!.id}`,
          },
          (payload) => {
            const n = payload.new as Notification;
            lastEventAt = n.created_at ?? new Date().toISOString();

            // Bump unread count
            setNotificationCounts((prev) => ({
              ...prev,
              notifications: prev.notifications + 1,
            }));

            // Push into the bell dropdown cache
            prependNotificationRef.current?.(n);

            // Show toast (deduped via toastedIdsRef)
            showNotificationToast(n);
          }
        )
        .subscribe((status) => {
          if (cancelled) return;

          if (status === "SUBSCRIBED") {
            // On reconnection, catch up on missed notifications
            if (retryCount > 0) {
              catchUpMissedNotifications();
            }
            retryCount = 0;
          }

          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            // Remove broken channel and retry with exponential backoff
            supabase.removeChannel(channel);
            channelRef = null;

            if (!cancelled && retryCount < MAX_RETRIES) {
              const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
              retryTimeout = setTimeout(() => {
                retryCount++;
                subscribe();
              }, delay);
            }
          }
        });

      channelRef = channel;
    }

    subscribe();

    return () => {
      cancelled = true;
      clearTimeout(retryTimeout);
      if (channelRef) {
        supabase.removeChannel(channelRef);
      }
    };
  }, [user, supabase, showNotificationToast, fetchCounts]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href={user ? "/props" : "/"} className="flex items-center gap-1 text-xl font-bold tracking-tight">
          <span className="text-primary">Alterna</span>
          <span className="text-foreground">Pick</span>
        </Link>

        {/* Desktop nav + bell */}
        <div className="hidden items-center gap-1 md:flex">
          {!loading && <Nav user={user} notificationCounts={notificationCounts} isAdmin={isAdminUser} />}
          {user && <StreakBadge />}
          {user && (
            <NotificationBell
              count={notificationCounts.notifications}
              onCountReset={() =>
                setNotificationCounts((prev) => ({ ...prev, notifications: 0 }))
              }
              onRegisterNewNotification={(cb) => {
                prependNotificationRef.current = cb;
              }}
            />
          )}
        </div>

        {/* Mobile: streak + bell + hamburger */}
        <div className="flex items-center gap-1 md:hidden">
          {user && <StreakBadge />}
          {user && (
            <NotificationBell
              count={notificationCounts.notifications}
              onCountReset={() =>
                setNotificationCounts((prev) => ({ ...prev, notifications: 0 }))
              }
            />
          )}
          {!loading && (
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 bg-background/95 backdrop-blur-xl border-border px-5 pt-5 pb-8">
                <SheetTitle className="text-lg font-bold">
                  <span className="text-primary">Alterna</span>Pick
                </SheetTitle>
                <div className="mt-2 border-t border-border pt-4">
                  <Nav
                    onNavigate={() => setSheetOpen(false)}
                    user={user}
                    notificationCounts={notificationCounts}
                    mobileSecondaryOnly={!!user}
                    isAdmin={isAdminUser}
                  />
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </header>
  );
}

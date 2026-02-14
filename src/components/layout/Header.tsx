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
import { POLL_INTERVAL_MS, getNotificationIcon, getNotificationTitle } from "@/lib/constants";
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

  // Callback registered by NotificationBell to prepend a new notification
  const prependNotificationRef = useRef<((n: Notification) => void) | null>(null);

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
      return;
    }
    fetchCounts();
  }, [user, pathname, fetchCounts]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(fetchCounts, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, fetchCounts]);

  // Supabase Realtime subscription for instant notifications
  useEffect(() => {
    if (!user || !supabase) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as Notification;

          // Bump unread count
          setNotificationCounts((prev) => ({
            ...prev,
            notifications: prev.notifications + 1,
          }));

          // Push into the bell dropdown cache
          prependNotificationRef.current?.(n);

          // Show toast
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, router]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-1 text-xl font-bold tracking-tight">
          <span className="text-primary">Alterna</span>
          <span className="text-foreground">Pick</span>
        </Link>

        {/* Desktop nav + bell */}
        <div className="hidden items-center gap-1 md:flex">
          {!loading && <Nav user={user} notificationCounts={notificationCounts} />}
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

        {/* Mobile: streak + bell + hamburger (secondary items only) */}
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
          {user ? (
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
                    mobileSecondaryOnly
                  />
                </div>
              </SheetContent>
            </Sheet>
          ) : !loading ? (
            <Link href="/auth/login">
              <Button variant="default" size="sm">
                Sign In
              </Button>
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}

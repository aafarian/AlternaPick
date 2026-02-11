"use client";

import Link from "next/link";
import Nav from "./Nav";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import NotificationBell from "./NotificationBell";
import StreakBadge from "./StreakBadge";
import { POLL_INTERVAL_MS } from "@/lib/constants";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import type { NotificationCounts } from "./Nav";

export default function Header() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const { user } = useAuth();
  const pathname = usePathname();
  const [notificationCounts, setNotificationCounts] =
    useState<NotificationCounts>({ friends: 0, challenges: 0, notifications: 0 });

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

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-1 text-xl font-bold tracking-tight">
          <span className="text-primary">Alterna</span>
          <span className="text-foreground">Pick</span>
        </Link>

        {/* Desktop nav + bell */}
        <div className="hidden items-center gap-1 md:flex">
          <Nav user={user} notificationCounts={notificationCounts} />
          {user && <StreakBadge />}
          {user && (
            <NotificationBell
              count={notificationCounts.notifications}
              onCountReset={() =>
                setNotificationCounts((prev) => ({ ...prev, notifications: 0 }))
              }
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
          {user && (
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 bg-background/95 backdrop-blur-xl border-border">
                <SheetTitle className="text-lg font-bold mb-4">
                  <span className="text-primary">Alterna</span>Pick
                </SheetTitle>
                <Nav
                  onNavigate={() => setSheetOpen(false)}
                  user={user}
                  notificationCounts={notificationCounts}
                  mobileSecondaryOnly
                />
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </header>
  );
}

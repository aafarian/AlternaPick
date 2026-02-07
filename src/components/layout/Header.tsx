"use client";

import Link from "next/link";
import Nav from "./Nav";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { usePathname } from "next/navigation";
import type { NotificationCounts } from "./Nav";

const POLL_INTERVAL_MS = 30_000;

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useAuth();
  const pathname = usePathname();
  const [notificationCounts, setNotificationCounts] =
    useState<NotificationCounts>({ friends: 0, challenges: 0 });

  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotificationCounts({
        friends: data.pendingFriendRequests ?? 0,
        challenges: data.pendingChallenges ?? 0,
      });
    } catch {
      // Silently ignore fetch errors for notification counts
    }
  }, []);

  // Fetch counts when user is authenticated, on mount and on navigation
  useEffect(() => {
    if (!user) {
      setNotificationCounts({ friends: 0, challenges: 0 });
      return;
    }

    fetchCounts();
  }, [user, pathname, fetchCounts]);

  // Poll every 30 seconds while user is authenticated
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(fetchCounts, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, fetchCounts]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-xl font-bold">
          <span className="text-accent">Sports</span>
          <span>Tower</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:block">
          <Nav user={user} notificationCounts={notificationCounts} />
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex flex-col gap-1.5 md:hidden"
          aria-label="Toggle menu"
        >
          <span
            className={`h-0.5 w-6 bg-foreground transition-transform ${menuOpen ? "translate-y-2 rotate-45" : ""}`}
          />
          <span
            className={`h-0.5 w-6 bg-foreground transition-opacity ${menuOpen ? "opacity-0" : ""}`}
          />
          <span
            className={`h-0.5 w-6 bg-foreground transition-transform ${menuOpen ? "-translate-y-2 -rotate-45" : ""}`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-border bg-background px-4 pb-4 md:hidden">
          <Nav
            onNavigate={() => setMenuOpen(false)}
            user={user}
            notificationCounts={notificationCounts}
          />
        </div>
      )}
    </header>
  );
}

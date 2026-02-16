"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import type { Notification } from "@/lib/supabase/types";
import { formatTimeAgo } from "@/lib/format";
import { getNotificationIcon, getNotificationTitle } from "@/lib/constants";
import { getNavigationPath } from "@/lib/notifications/utils";

interface NotificationBellProps {
  count: number;
  onCountReset: () => void;
  /** Header registers a callback so it can push realtime notifications into the dropdown. */
  onRegisterNewNotification?: (cb: (n: Notification) => void) => void;
}

const MAX_DROPDOWN_ITEMS = 5;

export default function NotificationBell({
  count,
  onCountReset,
  onRegisterNewNotification,
}: NotificationBellProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  // Register a callback so the Header can push realtime notifications into dropdown
  useEffect(() => {
    if (!onRegisterNewNotification) return;
    onRegisterNewNotification((n: Notification) => {
      setNotifications((prev) => {
        // Dedup by ID, prepend, cap at MAX_DROPDOWN_ITEMS
        if (prev.some((existing) => existing.id === n.id)) return prev;
        return [n, ...prev].slice(0, MAX_DROPDOWN_ITEMS);
      });
    });
  }, [onRegisterNewNotification]);

  const handleOpenChange = useCallback(
    async (isOpen: boolean) => {
      setOpen(isOpen);
      if (!isOpen) return;

      // Fetch recent notifications
      setLoading(true);
      try {
        const res = await fetch("/api/notifications?type=both&limit=5");
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications ?? []);
        }
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
      } finally {
        setLoading(false);
      }

      // Mark all as read if there are unread
      if (count > 0) {
        onCountReset();
        fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "mark_all_read" }),
        }).catch((err) => {
          console.error("Failed to mark notifications as read:", err);
        });
      }
    },
    [count, onCountReset]
  );

  const handleItemClick = (notification: Notification) => {
    setOpen(false);
    const path = getNavigationPath(notification);
    if (path) router.push(path);
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="text-sm font-semibold">
          Notifications
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="max-h-[360px] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-6">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            </div>
          )}

          {!loading && notifications.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          )}

          {!loading &&
            notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleItemClick(n)}
                className="group flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/50 focus:bg-secondary/50 focus:outline-none"
              >
                <span className="mt-0.5 text-base leading-none">
                  {getNotificationIcon(n.type)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{getNotificationTitle(n.type, n.title, n.body)}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground" title={n.body}>
                    {n.body}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground/60">
                    {formatTimeAgo(n.created_at, true)}
                  </p>
                </div>
                {!n.read && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                )}
              </button>
            ))}
        </div>

        <DropdownMenuSeparator />
        <div className="p-1">
          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center rounded-sm px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            View all
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

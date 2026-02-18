"use client";

import type { Notification } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { formatTimeAgo } from "@/lib/format";
import { getNotificationIcon, getNotificationAccent, getNotificationTitle } from "@/lib/constants";
import { motion, AnimatePresence, useReducedMotion } from "@/lib/motion";

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onNavigate: (notification: Notification) => void;
}

export default function NotificationItem({
  notification,
  onMarkRead,
  onNavigate,
}: NotificationItemProps) {
  const prefersReduced = useReducedMotion();
  const icon = getNotificationIcon(notification.type);
  const accentClass = getNotificationAccent(notification.type);
  const timeAgo = formatTimeAgo(notification.created_at);

  const handleClick = () => {
    if (!notification.read) {
      onMarkRead(notification.id);
    }
    onNavigate(notification);
  };

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      whileHover={
        prefersReduced
          ? undefined
          : { y: -2, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }
      }
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={cn(
        "flex min-h-[44px] w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-secondary/50",
        notification.read
          ? "border-border bg-card"
          : "border-primary/30 bg-card"
      )}
    >
      {/* Icon */}
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${accentClass}`}
      >
        {icon}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-sm leading-relaxed",
                notification.read ? "text-muted-foreground" : "font-semibold"
              )}
            >
              {getNotificationTitle(notification.type, notification.title, notification.body)}
            </p>
            <p
              className={cn(
                "mt-0.5 text-sm leading-relaxed",
                notification.read ? "text-muted-foreground" : "text-foreground/80"
              )}
            >
              {notification.body}
            </p>
          </div>
          {/* Unread indicator — fades out smoothly when marked as read */}
          <AnimatePresence>
            {!notification.read && (
              <motion.span
                initial={{ opacity: 1, scale: 1 }}
                exit={
                  prefersReduced
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.5 }
                }
                transition={{ duration: prefersReduced ? 0 : 0.3, ease: "easeOut" }}
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
              />
            )}
          </AnimatePresence>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{timeAgo}</p>
      </div>
    </motion.button>
  );
}

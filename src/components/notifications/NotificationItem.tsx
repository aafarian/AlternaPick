"use client";

import type { Notification, NotificationType } from "@/lib/supabase/types";

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onNavigate: (notification: Notification) => void;
}

function formatTimeAgo(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  return `${diffDays}d ago`;
}

function getIcon(type: NotificationType): string {
  switch (type) {
    case "card_resolved":
      return "\uD83C\uDFAF";
    case "challenge_resolved":
      return "\u2694\uFE0F";
    case "challenge_received":
      return "\uD83D\uDCE9";
    case "challenge_accepted":
      return "\u2705";
    case "friend_request":
      return "\uD83D\uDC64";
    case "friend_accepted":
      return "\uD83E\uDD1D";
    default:
      return "\uD83D\uDD14";
  }
}

function getAccentClass(type: NotificationType): string {
  switch (type) {
    case "card_resolved":
      return "bg-emerald-500/15 text-emerald-400";
    case "challenge_resolved":
      return "bg-indigo-500/15 text-indigo-400";
    case "challenge_received":
      return "bg-orange-500/15 text-orange-400";
    case "challenge_accepted":
      return "bg-green-500/15 text-green-400";
    case "friend_request":
      return "bg-blue-500/15 text-blue-400";
    case "friend_accepted":
      return "bg-amber-500/15 text-amber-400";
    default:
      return "bg-muted/15 text-muted";
  }
}

export default function NotificationItem({
  notification,
  onMarkRead,
  onNavigate,
}: NotificationItemProps) {
  const icon = getIcon(notification.type);
  const accentClass = getAccentClass(notification.type);
  const timeAgo = formatTimeAgo(notification.created_at);

  const handleClick = () => {
    if (!notification.read) {
      onMarkRead(notification.id);
    }
    onNavigate(notification);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors hover:bg-surface-hover ${
        notification.read
          ? "border-border bg-surface"
          : "border-accent/30 bg-surface"
      }`}
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
              className={`text-sm leading-relaxed ${
                notification.read ? "text-muted" : "font-semibold"
              }`}
            >
              {notification.title}
            </p>
            <p
              className={`mt-0.5 text-sm leading-relaxed ${
                notification.read ? "text-muted" : "text-foreground/80"
              }`}
            >
              {notification.body}
            </p>
          </div>
          {/* Unread indicator */}
          {!notification.read && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
          )}
        </div>
        <p className="mt-1 text-xs text-muted">{timeAgo}</p>
      </div>
    </button>
  );
}

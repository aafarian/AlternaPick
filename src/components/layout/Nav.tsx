"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import type { AuthUser } from "@/lib/auth/types";
import NotificationBadge from "./NotificationBadge";

interface NavLink {
  href: string;
  label: string;
  badgeKey?: "friends" | "challenges" | "notifications";
}

const authenticatedLinks: NavLink[] = [
  { href: "/props", label: "Props" },
  { href: "/cards", label: "My Cards" },
  { href: "/challenges", label: "Challenges", badgeKey: "challenges" },
  { href: "/friends", label: "Friends", badgeKey: "friends" },
  { href: "/activity", label: "Activity" },
  { href: "/notifications", label: "Notifications", badgeKey: "notifications" },
  { href: "/history", label: "History" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/profile", label: "Profile" },
];

const publicLinks: NavLink[] = [
  { href: "/props", label: "Props" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export interface NotificationCounts {
  friends: number;
  challenges: number;
  notifications: number;
}

export default function Nav({
  onNavigate,
  user,
  notificationCounts,
}: {
  onNavigate?: () => void;
  user?: AuthUser | null;
  notificationCounts?: NotificationCounts;
}) {
  const pathname = usePathname();
  const links = user ? authenticatedLinks : publicLinks;

  return (
    <nav className="flex flex-col gap-1 md:flex-row md:items-center md:gap-1 md:overflow-x-auto md:scrollbar-none">
      {links.map((link) => {
        const isActive = pathname === link.href;
        const badgeCount =
          link.badgeKey && notificationCounts
            ? notificationCounts[link.badgeKey]
            : 0;

        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={`relative flex min-h-[44px] items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-accent/10 text-accent"
                : "text-muted hover:bg-surface-hover hover:text-foreground"
            }`}
          >
            {link.label}
            {badgeCount > 0 && <NotificationBadge count={badgeCount} />}
          </Link>
        );
      })}

      {user ? (
        <form action={signOut}>
          <button
            type="submit"
            onClick={onNavigate}
            className="flex min-h-[44px] items-center rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            Sign Out
          </button>
        </form>
      ) : (
        <Link
          href="/auth/login"
          onClick={onNavigate}
          className="flex min-h-[44px] items-center rounded-lg bg-accent/10 px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
        >
          Sign In
        </Link>
      )}
    </nav>
  );
}

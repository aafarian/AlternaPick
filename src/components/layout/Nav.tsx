"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import type { AuthUser } from "@/lib/auth/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  LayoutGrid,
  Swords,
  Users,
  Activity,
  Clock,
  User,
  Settings,
  LogOut,
  LogIn,
} from "lucide-react";

interface NavLink {
  href: string;
  label: string;
  icon: React.ElementType;
  badgeKey?: "friends" | "challenges";
}

const authenticatedLinks: NavLink[] = [
  { href: "/props", label: "Props", icon: LayoutGrid },
  { href: "/picks", label: "My Picks", icon: LayoutGrid },
  { href: "/challenges", label: "Challenges", icon: Swords, badgeKey: "challenges" },
  { href: "/friends", label: "Friends", icon: Users, badgeKey: "friends" },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/history", label: "History", icon: Clock },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];

const publicLinks: NavLink[] = [
  { href: "/props", label: "Props", icon: LayoutGrid },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
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
    <nav className="flex flex-col gap-1 md:flex-row md:items-center md:gap-0.5 md:overflow-x-auto md:scrollbar-none">
      {links.map((link) => {
        const isActive = pathname === link.href;
        const badgeCount =
          link.badgeKey && notificationCounts
            ? notificationCounts[link.badgeKey]
            : 0;
        const Icon = link.icon;

        return (
          <Link key={link.href} href={link.href} onClick={onNavigate}>
            <Button
              variant="ghost"
              size="sm"
              className={`relative w-full justify-start gap-2 md:w-auto ${
                isActive
                  ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 md:hidden" />
              {link.label}
              {badgeCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1.5 text-[10px] font-bold">
                  {badgeCount > 9 ? "9+" : badgeCount}
                </Badge>
              )}
            </Button>
          </Link>
        );
      })}

      {user ? (
        <form action={signOut}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            onClick={onNavigate}
            className="w-full justify-start gap-2 text-muted-foreground hover:bg-secondary hover:text-foreground md:w-auto"
          >
            <LogOut className="h-4 w-4 md:hidden" />
            Sign Out
          </Button>
        </form>
      ) : (
        <Link href="/auth/login" onClick={onNavigate}>
          <Button
            variant="default"
            size="sm"
            className="w-full justify-start gap-2 md:w-auto"
          >
            <LogIn className="h-4 w-4 md:hidden" />
            Sign In
          </Button>
        </Link>
      )}
    </nav>
  );
}

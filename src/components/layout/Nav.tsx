"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import type { AuthUser } from "@/lib/auth/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Trophy,
  LayoutGrid,
  Swords,
  Users,
  User,
  Settings,
  LogOut,
  LogIn,
  BarChart3,
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
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
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

/** Paths that are handled by the mobile BottomTabBar */
const bottomTabPaths = new Set(["/props", "/picks", "/challenges", "/leaderboard", "/profile"]);

export default function Nav({
  onNavigate,
  user,
  notificationCounts,
  mobileSecondaryOnly = false,
}: {
  onNavigate?: () => void;
  user?: AuthUser | null;
  notificationCounts?: NotificationCounts;
  mobileSecondaryOnly?: boolean;
}) {
  const pathname = usePathname();
  const baseLinks = user ? authenticatedLinks : publicLinks;
  const links = mobileSecondaryOnly
    ? baseLinks.filter((l) => !bottomTabPaths.has(l.href))
    : baseLinks;
  const isProfileActive =
    pathname === "/profile" || pathname === "/settings";

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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`w-full justify-start gap-2 md:w-auto ${
                isProfileActive
                  ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <User className="h-4 w-4 md:hidden" />
              Profile
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem asChild>
              <Link href="/profile" onClick={onNavigate} className="gap-2">
                <User className="h-4 w-4" />
                My Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" onClick={onNavigate} className="gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <form action={signOut} className="w-full">
                <button
                  type="submit"
                  onClick={onNavigate}
                  className="flex w-full items-center gap-2 text-sm"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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

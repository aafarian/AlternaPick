"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  Newspaper,
  Shield,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "@/lib/motion";

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
  { href: "/recap", label: "Recap", icon: Newspaper },
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
  isAdmin = false,
}: {
  onNavigate?: () => void;
  user?: AuthUser | null;
  notificationCounts?: NotificationCounts;
  mobileSecondaryOnly?: boolean;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  // Optimistic nav: track which link was clicked so it lights up instantly
  // instead of waiting for the route to fully resolve
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  useEffect(() => {
    setPendingPath(null);
  }, [pathname]);
  const activePath = pendingPath ?? pathname;

  const baseLinks = user ? authenticatedLinks : publicLinks;
  const links = mobileSecondaryOnly
    ? baseLinks.filter((l) => !bottomTabPaths.has(l.href))
    : baseLinks;
  const isProfileActive =
    activePath === "/profile" || activePath === "/settings";
  const isAdminActive = activePath.startsWith("/admin");

  return (
    <nav className={`flex flex-col md:flex-row md:items-center md:gap-0.5 md:overflow-x-auto md:scrollbar-none ${mobileSecondaryOnly ? "gap-1.5" : "gap-1"}`}>
      {links.map((link) => {
        const isActive = activePath === link.href;
        const badgeCount =
          link.badgeKey && notificationCounts
            ? notificationCounts[link.badgeKey]
            : 0;
        const Icon = link.icon;

        return (
          <Link key={link.href} href={link.href} onClick={() => { setPendingPath(link.href); onNavigate?.(); }}>
            <Button
              variant="ghost"
              size="sm"
              className={`relative w-full justify-start gap-2 md:w-auto ${
                mobileSecondaryOnly ? "h-10 text-sm" : ""
              } ${
                isActive
                  ? "text-primary hover:text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="desktop-nav-indicator"
                  className="absolute inset-0 rounded-md bg-primary/10"
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 500, damping: 30 }
                  }
                />
              )}
              <span className="relative z-[1] flex items-center gap-2">
                <Icon className="h-4 w-4 md:hidden" />
                {link.label}
                <AnimatePresence>
                  {badgeCount > 0 && (
                    <motion.span
                      key={`badge-${link.badgeKey}`}
                      initial={prefersReducedMotion ? false : { scale: 0, opacity: 0 }}
                      animate={prefersReducedMotion ? {} : { scale: 1, opacity: 1 }}
                      exit={prefersReducedMotion ? {} : { scale: 0, opacity: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      className="inline-flex"
                    >
                      <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1.5 text-[10px] font-bold">
                        {badgeCount > 9 ? "9+" : badgeCount}
                      </Badge>
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
            </Button>
          </Link>
        );
      })}

      {isAdmin && user && (
        <Link href="/admin" onClick={() => { setPendingPath("/admin"); onNavigate?.(); }}>
          <Button
            variant="ghost"
            size="sm"
            className={`relative w-full justify-start gap-2 md:w-auto ${
              mobileSecondaryOnly ? "h-10 text-sm" : ""
            } ${
              isAdminActive
                ? "text-primary hover:text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {isAdminActive && (
              <motion.div
                layoutId="desktop-nav-indicator"
                className="absolute inset-0 rounded-md bg-primary/10"
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 500, damping: 30 }
                }
              />
            )}
            <span className="relative z-[1] flex items-center gap-2">
              <Shield className="h-4 w-4 md:hidden" />
              Admin
            </span>
          </Button>
        </Link>
      )}

      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`w-full justify-start gap-2 md:w-auto focus-visible:ring-0 focus-visible:border-transparent ${
                mobileSecondaryOnly ? "h-10 text-sm" : ""
              } ${
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
              <Link href="/profile" onClick={() => { setPendingPath("/profile"); onNavigate?.(); }} className="gap-2">
                <User className="h-4 w-4" />
                My Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings" onClick={() => { setPendingPath("/settings"); onNavigate?.(); }} className="gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={async (e) => {
                e.preventDefault();
                onNavigate?.();
                // Sign out client-side so onAuthStateChange fires immediately
                const { createClient } = await import("@/lib/supabase/client");
                const supabase = createClient();
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
              className="gap-2 cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
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

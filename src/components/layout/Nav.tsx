"use client";

import Link from "next/link";
import { useOptimisticNav } from "@/hooks/useOptimisticNav";
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
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "@/lib/motion";

interface NavLink {
  href: string;
  label: string;
  icon: React.ElementType;
  badgeKey?: "friends" | "challenges";
}

interface NavDropdownGroup {
  label: string;
  icon: React.ElementType;
  children: NavLink[];
}

type NavItem = NavLink | NavDropdownGroup;

function isDropdownGroup(item: NavItem): item is NavDropdownGroup {
  return "children" in item;
}

const authenticatedItems: NavItem[] = [
  { href: "/props", label: "Props", icon: LayoutGrid },
  { href: "/picks", label: "My Picks", icon: LayoutGrid },
  { href: "/challenges", label: "Challenges", icon: Swords, badgeKey: "challenges" },
  {
    label: "Social",
    icon: Users,
    children: [
      { href: "/friends", label: "Friends", icon: Users, badgeKey: "friends" },
      { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
    ],
  },
  {
    label: "Insights",
    icon: BarChart3,
    children: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/recap", label: "Wrapped", icon: Newspaper },
    ],
  },
];

/** Flat list of all authenticated links (used for mobile drawer) */
const authenticatedLinks: NavLink[] = authenticatedItems.flatMap((item) =>
  isDropdownGroup(item) ? item.children : [item]
);

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
  const { activePath, setPendingPath } = useOptimisticNav();
  const prefersReducedMotion = useReducedMotion();

  const baseLinks = user ? authenticatedLinks : publicLinks;
  const mobileLinks = mobileSecondaryOnly
    ? baseLinks.filter((l) => !bottomTabPaths.has(l.href))
    : baseLinks;
  const desktopItems = user ? authenticatedItems : publicLinks;
  const isProfileActive =
    activePath === "/profile" || activePath === "/settings";
  const isAdminActive = activePath.startsWith("/admin");

  function renderStandaloneLink(link: NavLink) {
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
              ? "text-primary hover:text-primary hover:bg-transparent"
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
  }

  function renderDropdownGroup(group: NavDropdownGroup) {
    const isGroupActive = group.children.some((child) => activePath === child.href);
    const groupBadgeCount = group.children.reduce((sum, child) => {
      if (child.badgeKey && notificationCounts) {
        return sum + notificationCounts[child.badgeKey];
      }
      return sum;
    }, 0);
    const Icon = group.icon;

    return (
      <DropdownMenu key={group.label}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`group w-full justify-start gap-2 md:w-auto focus-visible:ring-0 focus-visible:border-transparent ${
              isGroupActive
                ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4 md:hidden" />
            {group.label}
            <ChevronDown className={`h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180 ${isGroupActive ? "text-primary" : "text-muted-foreground"}`} />
            <AnimatePresence>
              {groupBadgeCount > 0 && (
                <motion.span
                  key={`badge-${group.label}`}
                  initial={prefersReducedMotion ? false : { scale: 0, opacity: 0 }}
                  animate={prefersReducedMotion ? {} : { scale: 1, opacity: 1 }}
                  exit={prefersReducedMotion ? {} : { scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                  className="inline-flex"
                >
                  <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1.5 text-[10px] font-bold">
                    {groupBadgeCount > 9 ? "9+" : groupBadgeCount}
                  </Badge>
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {group.children.map((child) => {
            const childBadgeCount =
              child.badgeKey && notificationCounts
                ? notificationCounts[child.badgeKey]
                : 0;
            const ChildIcon = child.icon;
            return (
              <DropdownMenuItem key={child.href} asChild>
                <Link
                  href={child.href}
                  onClick={() => { setPendingPath(child.href); onNavigate?.(); }}
                  className="gap-2"
                >
                  <ChildIcon className="h-4 w-4" />
                  {child.label}
                  {childBadgeCount > 0 && (
                    <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-[10px] font-bold">
                      {childBadgeCount > 9 ? "9+" : childBadgeCount}
                    </Badge>
                  )}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <nav className={`flex flex-col md:flex-row md:items-center md:gap-0.5 md:overflow-x-auto md:scrollbar-none ${mobileSecondaryOnly ? "gap-1.5" : "gap-1"}`}>
      {/* Mobile: flat links; Desktop: mixed standalone + dropdown groups */}
      <div className="contents md:hidden">
        {mobileLinks.map((link) => renderStandaloneLink(link))}
      </div>
      <div className="hidden md:contents">
        {desktopItems.map((item) =>
          isDropdownGroup(item)
            ? renderDropdownGroup(item)
            : renderStandaloneLink(item)
        )}
      </div>

      {isAdmin && user && (
        <Link href="/admin" onClick={() => { setPendingPath("/admin"); onNavigate?.(); }}>
          <Button
            variant="ghost"
            size="sm"
            className={`relative w-full justify-start gap-2 md:w-auto ${
              mobileSecondaryOnly ? "h-10 text-sm" : ""
            } ${
              isAdminActive
                ? "text-primary hover:text-primary hover:bg-transparent"
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
                const { clearAnonymousId } = await import("@/lib/session/anonymous");
                const supabase = createClient();
                await supabase.auth.signOut();
                clearAnonymousId();
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

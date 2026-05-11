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
  ClipboardList,
  Swords,
  UserPlus,
  User,
  Settings,
  LogOut,
  LogIn,
  TrendingUp,
  Newspaper,
  Shield,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "@/lib/motion";

function NavBadge({
  count,
  animationKey,
  animated = true,
  className = "ml-1",
}: {
  count: number;
  animationKey?: string;
  animated?: boolean;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  const badge = (
    <Badge variant="destructive" className={`${className} h-5 min-w-5 px-1.5 text-[10px] font-bold`}>
      {count > 9 ? "9+" : count}
    </Badge>
  );

  if (!animated) return count > 0 ? badge : null;

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.span
          key={animationKey}
          initial={prefersReducedMotion ? false : { scale: 0, opacity: 0 }}
          animate={prefersReducedMotion ? {} : { scale: 1, opacity: 1 }}
          exit={prefersReducedMotion ? {} : { scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
          className="inline-flex"
        >
          {badge}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function NavNotifyBadge({ count }: { count: number }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.span
          initial={prefersReducedMotion ? false : { scale: 0, opacity: 0 }}
          animate={prefersReducedMotion ? {} : { scale: 1, opacity: 1 }}
          exit={prefersReducedMotion ? {} : { scale: 0, opacity: 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
          className="-ml-1 -mt-2.5 inline-flex"
        >
          <span className="flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        </motion.span>
      )}
    </AnimatePresence>
  );
}

interface NavLink {
  href: string;
  label: string;
  icon: React.ElementType;
  badgeKey?: "friends" | "challenges";
  /** Key for superscript notification badge. Shows count for "friends", 1 for analytics/wrapped. */
  notifyKey?: "analytics" | "wrapped" | "friends";
}

interface NavDropdownGroup {
  label: string;
  children: NavLink[];
}

type NavItem = NavLink | NavDropdownGroup;

function isDropdownGroup(item: NavItem): item is NavDropdownGroup {
  return "children" in item;
}

const activeTriggerStyle = "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary";
const activeChildStyle = "text-primary bg-primary/10 data-[highlighted]:bg-primary/15 data-[highlighted]:text-primary";

const authenticatedItems: NavItem[] = [
  { href: "/props", label: "Props", icon: LayoutGrid },
  { href: "/picks", label: "My Picks", icon: ClipboardList },
  { href: "/challenges", label: "Challenges", icon: Swords, badgeKey: "challenges" },
  { href: "/analytics", label: "Analytics", icon: TrendingUp, notifyKey: "analytics" },
  { href: "/recap", label: "Wrapped", icon: Newspaper, notifyKey: "wrapped" },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/friends", label: "Friends", icon: UserPlus, notifyKey: "friends" },
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
  analyticsUnseen: boolean;
  wrappedUnseen: boolean;
}

/** Paths that are handled by the mobile BottomTabBar */
const bottomTabPaths = new Set(["/props", "/picks", "/challenges", "/leaderboard", "/friends"]);

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
  const isAdminActive = activePath.startsWith("/admin");
  const isAccountActive =
    activePath === "/profile" || activePath === "/settings" || isAdminActive;

  function getNotifyCount(link: NavLink): number {
    if (!link.notifyKey || !notificationCounts) return 0;
    if (link.notifyKey === "analytics") return notificationCounts.analyticsUnseen ? 1 : 0;
    if (link.notifyKey === "wrapped") return notificationCounts.wrappedUnseen ? 1 : 0;
    if (link.notifyKey === "friends") return notificationCounts.friends;
    return 0;
  }

  function renderStandaloneLink(link: NavLink, context: "mobile" | "desktop" = "desktop") {
    const isActive = activePath === link.href;
    const badgeCount =
      link.badgeKey && notificationCounts
        ? notificationCounts[link.badgeKey]
        : 0;
    const notifyCount = !isActive ? getNotifyCount(link) : 0;
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
              layoutId={`${context}-nav-indicator`}
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
            <NavBadge count={badgeCount} animationKey={`badge-${link.badgeKey ?? link.href}`} />
            <NavNotifyBadge count={notifyCount} />
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
    return (
      <DropdownMenu key={group.label}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`group w-full justify-start gap-2 md:w-auto focus-visible:ring-0 focus-visible:border-transparent ${
              mobileSecondaryOnly ? "h-10 text-sm" : ""
            } ${
              isGroupActive
                ? activeTriggerStyle
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {group.label}
            <NavBadge count={groupBadgeCount} animationKey={`badge-${group.label}`} />
            <ChevronDown className={`h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180 ${isGroupActive ? "text-primary" : "text-muted-foreground"}`} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {group.children.map((child) => {
            const childBadgeCount =
              child.badgeKey && notificationCounts
                ? notificationCounts[child.badgeKey]
                : 0;
            const ChildIcon = child.icon;
            const isChildActive = activePath === child.href;
            return (
              <DropdownMenuItem key={child.href} asChild>
                <Link
                  href={child.href}
                  onClick={() => { setPendingPath(child.href); onNavigate?.(); }}
                  className={`gap-2 ${isChildActive ? activeChildStyle : ""}`}
                >
                  <ChildIcon className="h-4 w-4" />
                  {child.label}
                  <NavBadge count={childBadgeCount} animationKey={`badge-${child.badgeKey ?? child.href}`} animated={false} className="ml-auto" />
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
        {mobileLinks.map((link) => renderStandaloneLink(link, "mobile"))}
      </div>
      <div className="hidden md:contents">
        {desktopItems.map((item) =>
          isDropdownGroup(item)
            ? renderDropdownGroup(item)
            : renderStandaloneLink(item)
        )}
      </div>

      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                isAccountActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
              aria-label="Account menu"
            >
              <User className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem asChild>
              <Link
                href="/profile"
                onClick={() => { setPendingPath("/profile"); onNavigate?.(); }}
                className={`gap-2 ${activePath === "/profile" ? activeChildStyle : ""}`}
              >
                <User className="h-4 w-4" />
                My Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href="/settings"
                onClick={() => { setPendingPath("/settings"); onNavigate?.(); }}
                className={`gap-2 ${activePath === "/settings" ? activeChildStyle : ""}`}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem asChild>
                <Link
                  href="/admin"
                  onClick={() => { setPendingPath("/admin"); onNavigate?.(); }}
                  className={`gap-2 ${isAdminActive ? activeChildStyle : ""}`}
                >
                  <Shield className="h-4 w-4" />
                  Admin
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={async (e) => {
                e.preventDefault();
                onNavigate?.();
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

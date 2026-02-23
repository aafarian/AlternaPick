"use client";

import Link from "next/link";
import { useOptimisticNav } from "@/hooks/useOptimisticNav";
import { useAuth } from "@/lib/auth/auth-context";
import {
  LayoutGrid,
  LayoutList,
  Swords,
  Trophy,
  User,
} from "lucide-react";
import { motion, useReducedMotion } from "@/lib/motion";

interface Tab {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const tabs: Tab[] = [
  { href: "/props", label: "Props", icon: LayoutGrid },
  { href: "/picks", label: "Picks", icon: LayoutList },
  { href: "/challenges", label: "Challenges", icon: Swords },
  { href: "/leaderboard", label: "Board", icon: Trophy },
  { href: "/profile", label: "Profile", icon: User },
];

const springTransition = { type: "spring" as const, stiffness: 500, damping: 30 };
const instantTransition = { duration: 0 };

export default function BottomTabBar() {
  const { activePath, setPendingPath } = useOptimisticNav();
  const { user } = useAuth();
  const prefersReducedMotion = useReducedMotion();

  if (!user) return null;

  const transition = prefersReducedMotion ? instantTransition : springTransition;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
        {tabs.map((tab) => {
          const isActive =
            activePath === tab.href ||
            (tab.href !== "/" && activePath.startsWith(tab.href + "/"));
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              onClick={() => setPendingPath(tab.href)}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground"
              }`}
            >
              <motion.div
                animate={{ scale: isActive ? 1.15 : 1 }}
                transition={transition}
              >
                <Icon
                  className={`h-5 w-5 ${isActive ? "text-primary" : ""}`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </motion.div>
              <span>{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="bottom-tab-indicator"
                  className="absolute -bottom-1 h-0.5 w-4 rounded-full bg-primary"
                  style={{ boxShadow: "0 0 6px var(--color-primary)" }}
                  transition={transition}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

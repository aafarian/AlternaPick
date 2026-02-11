"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import {
  LayoutGrid,
  LayoutList,
  Swords,
  Trophy,
  User,
} from "lucide-react";

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

export default function BottomTabBar() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.href !== "/" && pathname.startsWith(tab.href + "/"));
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-medium transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${isActive ? "text-primary" : ""}`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

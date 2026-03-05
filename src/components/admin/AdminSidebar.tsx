"use client";

import { useState } from "react";
import Link from "next/link";
import { useOptimisticNav } from "@/hooks/useOptimisticNav";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  LayoutDashboard,
  Activity,
  Users,
  Search,
  Server,
  Settings,
  Menu,
} from "lucide-react";

interface AdminNavLink {
  href: string;
  label: string;
  icon: React.ElementType;
}

const adminLinks: AdminNavLink[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/activity", label: "Activity", icon: Activity },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/lookup", label: "Lookup", icon: Search },
  { href: "/admin/system", label: "System", icon: Server },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { activePath, setPendingPath } = useOptimisticNav();

  return (
    <nav className="flex flex-col gap-1">
      {adminLinks.map((link) => {
        const isActive =
          link.href === "/admin"
            ? activePath === "/admin"
            : activePath.startsWith(link.href);
        const Icon = link.icon;

        return (
          <Link key={link.href} href={link.href} onClick={() => { setPendingPath(link.href); onNavigate?.(); }}>
            <Button
              variant="ghost"
              className={`w-full justify-start gap-3 ${
                isActive
                  ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Button>
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile hamburger trigger + Sheet for admin sidebar */
export function AdminMobileNav() {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="md:hidden">
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle admin menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-64 bg-card border-border px-4 pt-4 pb-8"
        >
          <SheetTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-2">
            Admin
          </SheetTitle>
          <NavLinks onNavigate={() => setSheetOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Desktop sidebar for admin - always visible on md+ */
export default function AdminSidebar() {
  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-card p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 mb-3">
        Navigation
      </p>
      <NavLinks />
    </aside>
  );
}

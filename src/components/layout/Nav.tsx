"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import type { AuthUser } from "@/lib/auth/types";

const authenticatedLinks = [
  { href: "/props", label: "Props" },
  { href: "/cards", label: "My Cards" },
  { href: "/history", label: "History" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/profile", label: "Profile" },
];

const publicLinks = [
  { href: "/props", label: "Props" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export default function Nav({
  onNavigate,
  user,
}: {
  onNavigate?: () => void;
  user?: AuthUser | null;
}) {
  const pathname = usePathname();
  const links = user ? authenticatedLinks : publicLinks;

  return (
    <nav className="flex flex-col gap-1 md:flex-row md:items-center md:gap-1">
      {links.map((link) => {
        const isActive = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-accent/10 text-accent"
                : "text-muted hover:bg-surface-hover hover:text-foreground"
            }`}
          >
            {link.label}
          </Link>
        );
      })}

      {user ? (
        <form action={signOut}>
          <button
            type="submit"
            onClick={onNavigate}
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            Sign Out
          </button>
        </form>
      ) : (
        <Link
          href="/auth/login"
          onClick={onNavigate}
          className="rounded-lg bg-accent/10 px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20"
        >
          Sign In
        </Link>
      )}
    </nav>
  );
}

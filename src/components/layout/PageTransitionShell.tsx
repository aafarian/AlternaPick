"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Wraps page content and immediately replaces it with a generic loading
 * skeleton when a navigation link is clicked. This prevents the old page
 * from lingering on screen while Next.js resolves the new route.
 *
 * Once the route resolves (pathname changes), the skeleton is removed and
 * the new page's actual content (or its loading.tsx skeleton) renders.
 */
export default function PageTransitionShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [navigatingAway, setNavigatingAway] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Route resolved — show new page content
  useEffect(() => {
    setNavigatingAway(false);
    clearTimeout(timeoutRef.current);
  }, [pathname]);

  // Detect clicks on internal links (same approach as NavigationProgress)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      // Skip external links, hash links, mailto, tel
      if (/^(https?:|mailto:|tel:|#)/.test(href)) return;
      // Skip same-page navigations (query-only changes are fine)
      const cleanHref = href.split("?")[0].split("#")[0];
      if (cleanHref === pathname) return;

      setNavigatingAway(true);
      // Safety valve: auto-clear after 5s in case navigation is interrupted
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setNavigatingAway(false), 5000);
    }

    document.addEventListener("click", handleClick, { capture: true });
    return () =>
      document.removeEventListener("click", handleClick, { capture: true });
  }, [pathname]);

  useEffect(() => {
    return () => clearTimeout(timeoutRef.current);
  }, []);

  if (navigatingAway) {
    return (
      <div className="flex flex-col gap-6 py-8 animate-pulse">
        <div className="h-8 w-48 rounded-lg bg-muted" />
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-3/4 rounded bg-muted" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
          <div className="h-40 rounded-xl bg-muted" />
          <div className="h-40 rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

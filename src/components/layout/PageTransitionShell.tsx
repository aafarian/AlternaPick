"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Wraps page content and instantly fades it out when a navigation link is
 * clicked. This prevents the old page from lingering on screen while Next.js
 * resolves the new route — the route's own loading.tsx skeleton takes over.
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
      if (/^(https?:|mailto:|tel:|#)/.test(href)) return;
      const cleanHref = href.split("?")[0].split("#")[0];
      if (cleanHref === pathname) return;

      setNavigatingAway(true);
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

  return (
    <div
      className={
        navigatingAway
          ? "pointer-events-none opacity-0 transition-opacity duration-150"
          : "opacity-100"
      }
    >
      {children}
    </div>
  );
}

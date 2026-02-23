"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { useNavClickDetection } from "@/hooks/useNavClickDetection";

/** Get the top-level route segment: "/admin/users" → "/admin" */
function topSegment(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts.length > 0 ? `/${parts[0]}` : "/";
}

/**
 * Wraps page content and instantly fades it out when a navigation link is
 * clicked to a different top-level section. This prevents the old page from
 * lingering on screen while Next.js resolves the new route.
 *
 * Navigations within the same layout group (e.g. /admin/users → /admin/system)
 * are NOT faded — those layouts have their own persistent shell.
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

  useNavClickDetection((href) => {
    // Only fade when crossing top-level sections (e.g. /picks → /props).
    // Within the same section (e.g. /admin → /admin/users) the nested
    // layout persists, so fading would flash the entire shell.
    if (topSegment(href) === topSegment(pathname)) return;

    setNavigatingAway(true);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setNavigatingAway(false), 5000);
  });

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

"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Tracks an optimistic "pending" path so nav links light up immediately
 * instead of waiting for the route to resolve. Call `setPendingPath` in
 * the link's onClick; the hook clears it automatically when pathname updates.
 */
export function useOptimisticNav() {
  const pathname = usePathname();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  useEffect(() => {
    setPendingPath(null);
  }, [pathname]);

  return {
    activePath: pendingPath ?? pathname,
    setPendingPath,
    pathname,
  };
}

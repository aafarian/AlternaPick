"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Scrolls to the top of the page on every route change. */
export function ScrollToTop() {
  const pathname = usePathname();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

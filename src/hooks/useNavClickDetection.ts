"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Parses an internal navigation href from a click event on an <a> tag.
 * Returns the cleaned path or null if the click should be ignored.
 */
function parseNavClick(
  e: MouseEvent,
  pathname: string,
): string | null {
  const anchor = (e.target as HTMLElement).closest("a");
  if (!anchor) return null;

  const href = anchor.getAttribute("href");
  if (!href) return null;
  // Skip external, hash, mailto, tel links
  if (/^(https?:|mailto:|tel:|#)/.test(href)) return null;

  const cleanHref = href.split("?")[0].split("#")[0];
  // Skip same-page navigations
  if (cleanHref === pathname) return null;

  return cleanHref;
}

/**
 * Fires a callback when the user clicks an internal navigation link.
 * Uses requestAnimationFrame to defer the check so that handlers in the
 * bubble phase can call e.preventDefault() to cancel the navigation —
 * the callback will NOT fire for cancelled clicks.
 */
export function useNavClickDetection(
  onNavigate: (href: string) => void,
) {
  const pathname = usePathname();
  const callbackRef = useRef(onNavigate);
  callbackRef.current = onNavigate;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const href = parseNavClick(e, pathname);
      if (!href) return;

      // Defer to next frame so bubble-phase preventDefault() calls are
      // respected (capture fires before bubble, so we can't check here).
      requestAnimationFrame(() => {
        if (e.defaultPrevented) return;
        callbackRef.current(href);
      });
    }

    document.addEventListener("click", handleClick, { capture: true });
    return () =>
      document.removeEventListener("click", handleClick, { capture: true });
  }, [pathname]);
}

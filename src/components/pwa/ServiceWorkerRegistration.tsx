"use client";

import { useEffect } from "react";
import { logWarn } from "@/lib/logger";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => { logWarn("pwa", "Service worker registration failed", err); });
    }
  }, []);

  return null;
}

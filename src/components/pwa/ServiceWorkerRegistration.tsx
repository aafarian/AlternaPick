"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        // eslint-disable-next-line no-console
        console.warn("SW registration failed:", err);
      });
    }
  }, []);

  return null;
}

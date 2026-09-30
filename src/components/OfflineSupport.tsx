"use client";

import { useEffect } from "react";

/** Registers the service worker that keeps the atlas usable offline (production builds only). */
export function OfflineSupport() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline mode is a bonus; the site works the same without it.
    });
  }, []);
  return null;
}

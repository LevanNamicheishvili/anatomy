"use client";

import { useEffect } from "react";

/** Registers the service worker that keeps the atlas usable offline (production builds only). */
export function OfflineSupport() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      // A worker left over from a production run on this address would keep serving old build files
      // (dev file names don't change), so pages look half-styled. Remove it and its caches in dev.
      void navigator.serviceWorker.getRegistrations().then(async (registrations) => {
        if (!registrations.length) return;
        await Promise.all(registrations.map((r) => r.unregister()));
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        window.location.reload();
      });
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline mode is a bonus; the site works the same without it.
    });
  }, []);
  return null;
}

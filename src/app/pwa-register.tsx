"use client";

import * as React from "react";

// Registers the service worker so the app is installable / works offline-ish.
export function PwaRegister() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // The SW caches /_next/static cache-first. In development those chunks hold
    // the app's own code, so a cached worker serves stale JS after every edit
    // (the page won't reflect source changes even across restarts). Only run it
    // in production; in dev, tear down any worker + caches a prior session left.
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) void reg.unregister();
      });
      if ("caches" in window) void caches.keys().then((keys) => keys.forEach((k) => void caches.delete(k)));
      return;
    }

    const onLoad = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
  }, []);

  return null;
}

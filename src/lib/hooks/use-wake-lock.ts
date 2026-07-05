"use client";

import * as React from "react";
import NoSleep from "nosleep.js";

/**
 * Keep the screen awake while cooking. Prefers the native Screen Wake Lock API
 * (secure contexts) and falls back to a hidden looping muted video on insecure
 * origins / older Safari — both handled by `nosleep.js`.
 *
 * Imperative on purpose: the fallback `video.play()` must run inside the user's
 * tap (sticky activation), so `toggle()` is wired directly to `onClick` rather
 * than reacting to an effect.
 */
export function useWakeLock() {
  const ref = React.useRef<NoSleep | null>(null);
  const [active, setActive] = React.useState(false);

  const enable = React.useCallback(() => {
    // Constructed lazily on first use — client-only, so SSR never touches the DOM.
    if (!ref.current) ref.current = new NoSleep();
    void ref.current.enable().catch(() => {});
    setActive(true);
  }, []);

  const disable = React.useCallback(() => {
    ref.current?.disable();
    setActive(false);
  }, []);

  const toggle = React.useCallback(() => {
    if (active) disable();
    else enable();
  }, [active, enable, disable]);

  // Re-assert when returning to the foreground — locks/videos drop when the tab
  // is backgrounded.
  React.useEffect(() => {
    if (!active) return;
    function onVisible() {
      if (document.visibilityState === "visible") void ref.current?.enable().catch(() => {});
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [active]);

  // Release on unmount so leaving the page stops holding the screen.
  React.useEffect(() => () => ref.current?.disable(), []);

  return { active, toggle };
}

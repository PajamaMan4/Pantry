"use client";

import { usePathname } from "next/navigation";

/**
 * `not-found.tsx` takes no props and there is no server-side API for the
 * attempted pathname, so reading it on the client is the documented way to
 * show the user which URL actually failed.
 */
export function NotFoundPath() {
  const pathname = usePathname();
  if (!pathname) return null;

  return (
    <code className="rounded bg-muted px-1.5 py-1 font-mono text-sm break-all">{pathname}</code>
  );
}

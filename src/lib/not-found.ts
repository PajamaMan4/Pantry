import { notFound } from "next/navigation";

/**
 * `notFound()` wrappers that leave a breadcrumb in the server log.
 *
 * The root `not-found.tsx` is what Next.js renders both for our own
 * `notFound()` calls *and* for any URL the router failed to match, so a bare
 * 404 tells you nothing about which happened. Logging here — rather than in the
 * page, which Next also renders on successful responses — means the terminal
 * can tell the two apart:
 *
 *   GET /recipes/50 404  + "[404] recipe 50 not found in database"  -> row is gone
 *   GET /recipes/50 404  with no [404] line at all                  -> the router
 *     never matched the path. That is the Turbopack dev-server bug where nested
 *     routes drop out of the in-memory route table; restart `npm run dev`.
 */

/** The id parsed fine but no such row exists. */
export function notFoundWithReason(kind: string, id: number | string): never {
  console.warn(`[404] ${kind} ${id} not found in database`);
  notFound();
}

/** The id in the URL was never a usable number. */
export function notFoundInvalidId(kind: string, raw: string): never {
  console.warn(`[404] invalid ${kind} id: ${JSON.stringify(raw)}`);
  notFound();
}

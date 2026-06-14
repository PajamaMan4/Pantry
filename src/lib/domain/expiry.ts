// Expiry status for inventory "use soon" / "expired" badges (§3.4). Pure + tested.

export type ExpiryStatus = "expired" | "soon" | "ok";

export const USE_SOON_DAYS = 7;

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/** Whole calendar days from `now` until `date` (negative = in the past). */
export function daysUntil(date: Date, now: Date): number {
  return Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
}

export function expiryStatus(
  expiry: Date | null | undefined,
  now: Date,
  soonDays: number = USE_SOON_DAYS,
): ExpiryStatus | null {
  if (!expiry) return null;
  const d = daysUntil(expiry, now);
  if (d < 0) return "expired";
  if (d <= soonDays) return "soon";
  return "ok";
}

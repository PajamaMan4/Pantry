// Quantity formatting (§5.3): friendly fractions for imperial, sensible decimals
// for metric, with range and non-numeric ("to taste") support. Pure + tested.
import { UNITS, type Quantity, type UnitSystem } from "./units";

export type RoundingMode = "cooking" | "exact";

const FRACTIONS: [number, string][] = [
  [0.125, "⅛"],
  [0.25, "¼"],
  [1 / 3, "⅓"],
  [0.375, "⅜"],
  [0.5, "½"],
  [0.625, "⅝"],
  [2 / 3, "⅔"],
  [0.75, "¾"],
  [0.875, "⅞"],
];

function trimDecimals(n: number, places: number): string {
  const f = Math.pow(10, places);
  return String(Math.round(n * f) / f);
}

/** 1.75 → "1¾", 0.5 → "½", 2 → "2". "exact" mode skips fractions. */
export function toFriendlyFraction(n: number, rounding: RoundingMode = "cooking"): string {
  if (!Number.isFinite(n)) return String(n);
  if (rounding === "exact") return trimDecimals(n, 3);

  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const whole = Math.floor(abs);
  const frac = abs - whole;

  let best = "";
  let bestErr = 0.06;
  for (const [v, glyph] of FRACTIONS) {
    const err = Math.abs(frac - v);
    if (err < bestErr) {
      best = glyph;
      bestErr = err;
    }
  }
  // Close to the next whole number (e.g. 1.97 → 2).
  if (1 - frac < bestErr) return `${sign}${whole + 1}`;
  if (!best) return sign + trimDecimals(abs, 2);
  return whole > 0 ? `${sign}${whole}${best}` : `${sign}${best}`;
}

/** grams/millilitres → whole numbers (cooking); litres/kg → 2dp. */
export function toMetricNumber(
  n: number,
  unit: string | null,
  rounding: RoundingMode = "cooking",
): string {
  if (unit === "g" || unit === "ml") {
    return rounding === "exact" ? trimDecimals(n, 1) : String(Math.round(n));
  }
  if (unit === "kg" || unit === "l") {
    return trimDecimals(n, rounding === "exact" ? 3 : 2);
  }
  return trimDecimals(n, 2);
}

export function formatQuantity(
  q: Quantity,
  system: UnitSystem,
  rounding: RoundingMode = "cooking",
): string {
  if (q.amount == null) return q.raw ?? ""; // "to taste"
  const fmt = (n: number) =>
    system === "imperial" ? toFriendlyFraction(n, rounding) : toMetricNumber(n, q.unit, rounding);
  const main = fmt(q.amount);
  const range = q.amountMax != null ? `–${fmt(q.amountMax)}` : "";
  const label = q.unit ? (UNITS[q.unit]?.label ?? q.unit) : "";
  return `${main}${range}${label ? ` ${label}` : ""}`.trim();
}

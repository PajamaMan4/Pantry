// Serving scaler + inline step rewriting (§5.1). Pure + heavily tested — this is
// where correctness lives. Scaling is always a render-time transform over the
// base recipe; it never mutates stored data.
import { UNITS, toSystem, type UnitSystem } from "./units";
import { formatQuantity, toFriendlyFraction, type RoundingMode } from "./quantity";

export type DisplaySystem = UnitSystem | "original";

export interface DisplayOptions {
  factor: number;
  system: DisplaySystem;
  rounding?: RoundingMode;
  density?: number;
}

type QuantityLike = {
  amount: number | null;
  amountMax?: number | null;
  unit: string | null;
  raw?: string | null;
};

type StepQuantityLike = {
  ingredientId: number | null;
  amount: number;
  amountMax?: number | null;
  unit: string | null;
};

type StepLike = {
  text: string;
  quantities?: Record<string, StepQuantityLike>;
};

export function scaleFactor(base: number, target: number): number {
  return base > 0 ? target / base : 1;
}

/** Scale numeric amounts (and range max). Non-numeric and approximate ("pinch",
 *  "to taste") amounts are returned unchanged — they are never scaled. */
export function scaleIngredientAmount(
  amount: number | null,
  amountMax: number | null,
  factor: number,
  approximate = false,
): { amount: number | null; amountMax: number | null } {
  if (amount == null || approximate) return { amount, amountMax };
  return { amount: amount * factor, amountMax: amountMax == null ? null : amountMax * factor };
}

function isApproximate(unit: string | null | undefined): boolean {
  return unit ? !!UNITS[unit]?.approximate : false;
}

/** Pick the formatting system: in "original" mode it follows the unit's own system. */
function formatSystemFor(unit: string | null, system: DisplaySystem): UnitSystem {
  if (system !== "original") return system;
  const def = unit ? UNITS[unit] : undefined;
  return def && def.system === "imperial" ? "imperial" : "metric";
}

/**
 * Scale → (optionally) convert system → format a single quantity for display.
 * The one code path used by both the ingredient list and inline step text.
 */
export function displayQuantity(q: QuantityLike, opts: DisplayOptions): string {
  const approximate = isApproximate(q.unit);
  const scaled = scaleIngredientAmount(q.amount, q.amountMax ?? null, opts.factor, approximate);

  if (scaled.amount == null) {
    return formatQuantity(
      { amount: null, amountMax: null, unit: q.unit, raw: q.raw ?? null },
      "metric",
      opts.rounding,
    );
  }

  let amount = scaled.amount;
  let amountMax = scaled.amountMax;
  let unit = q.unit;

  if (opts.system !== "original" && !approximate) {
    const conv = toSystem({ amount, amountMax, unit }, opts.system, opts.density);
    amount = conv.amount;
    amountMax = conv.amountMax;
    unit = conv.unit;
  }

  return formatQuantity(
    { amount, amountMax, unit, raw: q.raw ?? null },
    formatSystemFor(unit, opts.system),
    opts.rounding,
  );
}

/**
 * Render step text, substituting {qN} placeholders with scaled + converted +
 * formatted amounts. Literal prose (oven temps, times) has no placeholders, so
 * it is left untouched. Steps with no linked quantities are returned verbatim
 * unless `fallback` is enabled (the opt-in best-effort path below).
 */
export function renderStep(
  step: StepLike,
  opts: DisplayOptions & {
    densityFor?: (id: number | null) => number | undefined;
    fallback?: boolean;
  },
): string {
  if (!step.quantities || Object.keys(step.quantities).length === 0) {
    return opts.fallback ? maybeFallbackScale(step.text, opts) : step.text;
  }
  return step.text.replace(/\{(\w+)\}/g, (match, key: string) => {
    const q = step.quantities?.[key];
    if (!q) return match;
    const density = opts.densityFor?.(q.ingredientId);
    return displayQuantity(
      { amount: q.amount, amountMax: q.amountMax ?? null, unit: q.unit },
      { ...opts, density },
    );
  });
}

// ---- Conservative fallback for untokenized steps (opt-in) -------------------
// Scales ONLY <number><measurement-unit> spans. The unit alternation excludes
// time/temperature words, so "Bake at 350°F for 20 minutes" is never touched.
const MEASURE_RE =
  /(\d+\s+\d+\/\d+|\d+\/\d+|[½⅓⅔¼¾⅛⅜⅝⅞]|\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?)\s*(cups?|tbsps?|tablespoons?|tsps?|teaspoons?|fl\s?oz|ml|millilit(?:re|er)s?|l|lit(?:re|er)s?|oz|ounces?|lbs?|pounds?|g|grams?|kg|kilograms?)\b/gi;

const UNICODE_FRAC: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

function parseLoose(s: string): number | null {
  const t = s.trim();
  if (UNICODE_FRAC[t] != null) return UNICODE_FRAC[t];
  let m = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = t.match(/^(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function maybeFallbackScale(text: string, opts: DisplayOptions): string {
  if (opts.factor === 1) return text;
  const fmt = (n: number) =>
    opts.system === "metric" ? String(Math.round(n * 100) / 100) : toFriendlyFraction(n, opts.rounding);

  return text.replace(MEASURE_RE, (match, numPart: string, unitWord: string) => {
    const rangeParts = numPart.split(/\s*[-–]\s*/);
    const scaledNums = rangeParts.map((p) => {
      const v = parseLoose(p);
      return v == null ? null : v * opts.factor;
    });
    if (scaledNums.some((v) => v == null)) return match; // bail if we can't parse
    return `${scaledNums.map((v) => fmt(v!)).join("–")} ${unitWord}`;
  });
}

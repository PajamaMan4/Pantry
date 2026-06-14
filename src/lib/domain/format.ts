// Presentational helpers (pure, testable).
import { UNITS, convert, categoryOf } from "./units";

/** Round to at most 2 decimals and drop trailing zeros: 2 -> "2", 1.5 -> "1.5". */
export function formatNumber(n: number): string {
  return (Math.round(n * 100) / 100).toString();
}

export function unitLabel(unit: string | null | undefined): string {
  if (!unit) return "";
  return UNITS[unit]?.label ?? unit;
}

export function formatMoney(value: number, currency: string): string {
  const maximumFractionDigits = value !== 0 && Math.abs(value) < 1 ? 3 : 2;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export type PriceDisplaySystem = "metric" | "imperial" | "original";

/**
 * Express a per-default-unit price in a readable unit for the chosen system:
 * mass → kg (metric) or lb (imperial); volume → L (metric) or cup (imperial).
 * Counts / unit-less prices are left as-is. "original" displays like metric.
 */
export function pricePerDisplayUnit(
  perDefaultUnit: number,
  defaultUnit: string | null,
  system: PriceDisplaySystem = "metric",
): { value: number; unitLabel: string } {
  const category = categoryOf(defaultUnit);
  if (!defaultUnit || !category || category === "count") {
    return { value: perDefaultUnit, unitLabel: unitLabel(defaultUnit) };
  }
  const imperial = system === "imperial";
  const target = category === "mass" ? (imperial ? "lb" : "kg") : imperial ? "cup" : "l";
  // price per target unit = price per default unit × (default units in one target)
  const value = perDefaultUnit * convert(1, target, defaultUnit);
  return { value, unitLabel: UNITS[target].label };
}

/**
 * Render a stored quantity as text for the ingredient list (Phase 1, display
 * only): "2 cup", "0.5 tsp", "2–3 cloves", or the raw descriptor ("to taste").
 */
export function formatQuantityText(q: {
  amount: number | null;
  amountMax?: number | null;
  unit: string | null;
  raw?: string | null;
}): string {
  if (q.amount == null) return q.raw ?? "";
  const main = formatNumber(q.amount);
  const range = q.amountMax != null ? `–${formatNumber(q.amountMax)}` : "";
  const label = unitLabel(q.unit);
  return `${main}${range}${label ? ` ${label}` : ""}`.trim();
}

/** Total time is derived, never stored (§3.1). */
export function totalTimeMin(
  prep: number | null | undefined,
  cook: number | null | undefined,
): number | null {
  if (prep == null && cook == null) return null;
  return (prep ?? 0) + (cook ?? 0);
}

export function formatMinutes(min: number | null | undefined): string {
  if (min == null) return "—";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

type StepLike = {
  text: string;
  quantities?: Record<string, { amount: number; amountMax?: number | null; unit: string | null }>;
};

/**
 * Render a step's text, substituting {qN} placeholders with their stored amounts
 * (display only — NO scaling or unit conversion; that's Phase 2 §5.1). Literal
 * prose like oven temps and times contains no placeholders, so it's untouched.
 */
export function renderStepText(step: StepLike): string {
  if (!step.quantities) return step.text;
  return step.text.replace(/\{(\w+)\}/g, (match, key: string) => {
    const q = step.quantities?.[key];
    if (!q) return match;
    return formatQuantityText({ amount: q.amount, amountMax: q.amountMax ?? null, unit: q.unit });
  });
}

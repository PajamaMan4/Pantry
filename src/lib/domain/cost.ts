// Price normalization + summary (§5.4, price portion). Pure + tested.
// recipeCost() (the cost calculator) is added in Phase 5; this file currently
// covers turning dated price entries into a normalized range/average that the
// inventory + ingredient screens display (§3.5).
import { convert } from "./units";

export type PriceMode = "current" | "average";

export interface PriceEntryLike {
  price: number; // total paid
  quantity: number; // ...for this much
  unit: string; // ...of this unit
  store?: string | null;
  purchasedAt: Date;
}

export interface IngredientPricing {
  defaultUnit: string | null;
  density?: number | null;
}

export interface NormalizedPrice {
  date: Date;
  perDefaultUnit: number;
  store: string | null;
}

export function monthsAgo(now: Date, months: number): Date {
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d;
}

/**
 * Convert each entry to a price per the ingredient's default unit. Entries whose
 * unit can't be converted to the default unit (e.g. "each" with no density to a
 * mass unit) are dropped. Returns [] when the ingredient has no default unit.
 */
export function normalizePrices(
  entries: PriceEntryLike[],
  ingredient: IngredientPricing,
): NormalizedPrice[] {
  if (!ingredient.defaultUnit) return [];
  const out: NormalizedPrice[] = [];
  for (const e of entries) {
    if (!(e.quantity > 0)) continue;
    try {
      const perUnit = e.price / e.quantity; // per 1 of e.unit
      const factor = convert(1, e.unit, ingredient.defaultUnit, ingredient.density ?? undefined);
      out.push({ date: e.purchasedAt, perDefaultUnit: perUnit / factor, store: e.store ?? null });
    } catch {
      // unconvertible price unit → drop from the summary
    }
  }
  return out;
}

export interface PriceSummary {
  defaultUnit: string | null;
  count: number; // entries used (in-window, or all-time if window empty)
  totalCount: number; // total normalized entries
  windowed: boolean; // false => fell back to all-time
  min: number | null;
  max: number | null;
  average: number | null;
  latest: number | null; // most recent overall
  points: { date: Date; price: number; store: string | null }[]; // ascending, for the chart
}

const EMPTY = (defaultUnit: string | null): PriceSummary => ({
  defaultUnit,
  count: 0,
  totalCount: 0,
  windowed: true,
  min: null,
  max: null,
  average: null,
  latest: null,
  points: [],
});

export function priceSummary(
  entries: PriceEntryLike[],
  ingredient: IngredientPricing,
  windowMonths: number,
  now: Date,
): PriceSummary {
  const all = normalizePrices(entries, ingredient).sort((a, b) => +a.date - +b.date);
  if (all.length === 0) return EMPTY(ingredient.defaultUnit);

  const since = monthsAgo(now, windowMonths);
  const win = all.filter((p) => p.date >= since);
  const pool = win.length ? win : all;
  const prices = pool.map((p) => p.perDefaultUnit);

  return {
    defaultUnit: ingredient.defaultUnit,
    count: pool.length,
    totalCount: all.length,
    windowed: win.length > 0,
    min: Math.min(...prices),
    max: Math.max(...prices),
    average: prices.reduce((s, x) => s + x, 0) / prices.length,
    latest: all[all.length - 1].perDefaultUnit,
    points: pool.map((p) => ({ date: p.date, price: p.perDefaultUnit, store: p.store })),
  };
}

/** Single representative unit price for the cost calculator (Phase 5). */
export function unitPrice(
  entries: PriceEntryLike[],
  ingredient: IngredientPricing,
  mode: PriceMode,
  windowMonths: number,
  now: Date,
): number | null {
  const all = normalizePrices(entries, ingredient);
  if (!all.length) return null;
  if (mode === "current") {
    return all.slice().sort((a, b) => +b.date - +a.date)[0].perDefaultUnit;
  }
  const since = monthsAgo(now, windowMonths);
  const win = all.filter((p) => p.date >= since);
  const pool = win.length ? win : all;
  return pool.reduce((s, x) => s + x.perDefaultUnit, 0) / pool.length;
}

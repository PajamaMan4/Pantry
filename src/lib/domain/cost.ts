// Price normalization, summary, and the recipe cost calculator (§5.4). Pure +
// tested — turns dated price entries into a normalized range/average (§3.5) and
// estimates a recipe's cost from amount-used × price-per-unit (§3.7).
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

// ---- Recipe cost calculator (§3.7 / §5.4) -----------------------------------
export interface CostIngredient {
  ingredientId: number;
  amount: number | null;
  unit: string | null;
  optional: boolean;
  defaultUnit: string | null;
  density: number | null;
}

export interface LineCost {
  ingredientId: number;
  cost: number | null;
  reason?: "no-price" | "unconvertible";
}

export interface RecipeCost {
  total: number; // base-batch cost of the priced lines
  perServing: number; // scale-invariant
  lines: LineCost[]; // one per non-optional ingredient
  unknownIngredientIds: number[];
  knownCount: number; // priced lines
  countedCount: number; // non-optional ingredients considered
}

/**
 * Estimate a recipe's cost from `amount used × price-per-default-unit`, computed
 * on `servings` (use base servings; per-serving is scale-invariant). Optional
 * ingredients are excluded. Lines with no price, no amount, or an unconvertible
 * unit are flagged and kept out of the total so it's honest about what it omits.
 *
 * `priceByIngredient` maps ingredientId → price per the ingredient's default
 * unit (or null when unpriced) — typically built from `unitPrice()`.
 */
export function recipeCost(
  ingredients: CostIngredient[],
  priceByIngredient: Map<number, number | null>,
  servings: number,
): RecipeCost {
  let total = 0;
  const lines: LineCost[] = [];
  const unknown: number[] = [];
  let countedCount = 0;

  for (const r of ingredients) {
    if (r.optional) continue;
    countedCount += 1;
    const price = priceByIngredient.get(r.ingredientId) ?? null;

    if (price == null || r.amount == null || r.unit == null || r.defaultUnit == null) {
      unknown.push(r.ingredientId);
      lines.push({ ingredientId: r.ingredientId, cost: null, reason: "no-price" });
      continue;
    }
    try {
      const amtInDefault = convert(r.amount, r.unit, r.defaultUnit, r.density ?? undefined);
      const cost = amtInDefault * price;
      total += cost;
      lines.push({ ingredientId: r.ingredientId, cost });
    } catch {
      unknown.push(r.ingredientId);
      lines.push({ ingredientId: r.ingredientId, cost: null, reason: "unconvertible" });
    }
  }

  return {
    total,
    perServing: servings > 0 ? total / servings : total,
    lines,
    unknownIngredientIds: unknown,
    knownCount: countedCount - unknown.length,
    countedCount,
  };
}

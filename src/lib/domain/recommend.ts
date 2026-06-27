// Recipe recommendations (§3.8 / §5.5). Pure + tested. Given current inventory,
// score each recipe by ingredient coverage, surface near-misses, and sort by
// availability / soonest-expiring / lowest cost.
import { UNITS, convert, combineAmounts, type UnitCategory } from "./units";
import { daysUntil } from "./expiry";

export interface RecommendIngredient {
  ingredientId: number;
  amount: number | null;
  unit: string | null;
  optional: boolean;
  isStaple: boolean;
  density: number | null;
  gramsPerEach: number | null;
}

export interface RecommendRecipe {
  id: number;
  name: string;
  ingredients: RecommendIngredient[];
}

export interface InventoryStock {
  ingredientId: number;
  quantity: number;
  unit: string;
  expiryMs: number | null;
}

export type RecommendSort = "available" | "expiring" | "cost";

export interface RecommendResult {
  recipe: RecommendRecipe;
  requiredCount: number;
  haveCount: number;
  coverage: number; // 0..1
  missing: number[]; // ingredient ids (includes unconvertible "unknowns")
  almost: boolean; // 1–2 missing
  makeable: boolean;
  unknownUnits: number; // required ingredients in stock but with an unreconcilable unit
  cost: number | null; // per serving (Infinity-ranked last when null)
  expiryUrgency: number;
}

const EPS = 1e-9;
const EXPIRY_WINDOW_DAYS = 14;

type IngredientStock = { byCategory: Map<UnitCategory, number>; soonestExpiryMs: number | null };

/** Total each ingredient's stock in its category's base unit (ml / g / each). */
function aggregateStock(inventory: InventoryStock[]): Map<number, IngredientStock> {
  const map = new Map<number, IngredientStock>();
  for (const row of inventory) {
    const def = UNITS[row.unit];
    if (!def) continue;
    let entry = map.get(row.ingredientId);
    if (!entry) {
      entry = { byCategory: new Map(), soonestExpiryMs: null };
      map.set(row.ingredientId, entry);
    }
    entry.byCategory.set(def.category, (entry.byCategory.get(def.category) ?? 0) + row.quantity * def.toBase);
    if (row.expiryMs != null) {
      entry.soonestExpiryMs = entry.soonestExpiryMs == null ? row.expiryMs : Math.min(entry.soonestExpiryMs, row.expiryMs);
    }
  }
  return map;
}

type Avail = "have" | "missing" | "unknown";

const BASE_UNIT_FOR: Record<UnitCategory, string> = { mass: "g", volume: "ml", count: "each" };

function availability(req: RecommendIngredient, stock: IngredientStock | undefined): Avail {
  if (!stock) return "missing"; // not in inventory at all
  if (req.amount == null || req.unit == null) return "have"; // non-numeric required → assume on hand
  const def = UNITS[req.unit];
  if (!def) return "unknown";

  const reqBase = req.amount * def.toBase;
  const same = stock.byCategory.get(def.category);
  if (same != null) return reqBase <= same + EPS ? "have" : "missing";

  // Bridge across categories using convert(); try each stocked category.
  for (const [cat, stockBase] of stock.byCategory) {
    if (cat === def.category) continue;
    try {
      const reqConverted = convert(req.amount, req.unit, BASE_UNIT_FOR[cat], req.density ?? undefined, req.gramsPerEach ?? undefined);
      return reqConverted <= stockBase + EPS ? "have" : "missing";
    } catch {
      // can't bridge to this category — try others
    }
  }
  return "unknown"; // stocked, but in a category we can't reconcile
}

function expiryScore(required: RecommendIngredient[], stockMap: Map<number, IngredientStock>, now: Date): number {
  let score = 0;
  for (const req of required) {
    const stock = stockMap.get(req.ingredientId);
    if (!stock || stock.soonestExpiryMs == null) continue;
    const daysLeft = daysUntil(new Date(stock.soonestExpiryMs), now);
    score += daysLeft <= 0 ? 1 : Math.max(0, (EXPIRY_WINDOW_DAYS - daysLeft) / EXPIRY_WINDOW_DAYS);
  }
  return score;
}

export function recommendRecipes(
  recipes: RecommendRecipe[],
  inventory: InventoryStock[],
  sort: RecommendSort,
  costByRecipe: Map<number, number | null>,
  now: Date,
): RecommendResult[] {
  const stockMap = aggregateStock(inventory);

  const scored: RecommendResult[] = recipes.map((recipe) => {
    // Group by ingredient so duplicates (same ingredient in multiple lines/sections)
    // are combined into one requirement — mirroring what planCook does — before
    // checking availability. Without this, a secondary line in an incompatible unit
    // (e.g. "1 tbsp" when the ingredient is stocked as "each") incorrectly adds the
    // ingredient to the missing list even when the primary quantity is satisfied.
    const byIngredient = new Map<number, RecommendIngredient[]>();
    for (const i of recipe.ingredients) {
      const arr = byIngredient.get(i.ingredientId) ?? [];
      arr.push(i);
      byIngredient.set(i.ingredientId, arr);
    }

    const missing: number[] = [];
    let unknownUnits = 0;

    for (const [ingredientId, members] of byIngredient) {
      const first = members[0];
      // Staples are assumed available; optionals don't count against makeability.
      // Skip the group if every member is a staple or optional.
      if (members.every((m) => m.isStaple || m.optional)) continue;

      const { amount, unit } = combineAmounts(members, first.density, first.gramsPerEach);
      const combined: RecommendIngredient = { ...first, amount, unit, optional: false };
      const a = availability(combined, stockMap.get(ingredientId));
      if (a === "missing") missing.push(ingredientId);
      else if (a === "unknown") {
        unknownUnits += 1;
        missing.push(ingredientId);
      }
    }
    const requiredCount = [...byIngredient.values()].filter(
      (members) => !members.every((m) => m.isStaple || m.optional),
    ).length;
    const haveCount = requiredCount - missing.length;
    return {
      recipe,
      requiredCount,
      haveCount,
      coverage: requiredCount ? haveCount / requiredCount : 1,
      missing,
      almost: missing.length >= 1 && missing.length <= 2,
      makeable: missing.length === 0,
      unknownUnits,
      cost: costByRecipe.get(recipe.id) ?? null,
      expiryUrgency: expiryScore(recipe.ingredients, stockMap, now),
    };
  });

  const costOf = (r: RecommendResult) => (r.cost == null ? Infinity : r.cost);
  const byName = (a: RecommendResult, b: RecommendResult) => a.recipe.name.localeCompare(b.recipe.name);

  const comparators: Record<RecommendSort, (a: RecommendResult, b: RecommendResult) => number> = {
    available: (a, b) => b.coverage - a.coverage || a.missing.length - b.missing.length || costOf(a) - costOf(b) || byName(a, b),
    expiring: (a, b) => Number(b.makeable) - Number(a.makeable) || b.expiryUrgency - a.expiryUrgency || b.coverage - a.coverage || byName(a, b),
    cost: (a, b) => Number(b.makeable) - Number(a.makeable) || costOf(a) - costOf(b) || b.coverage - a.coverage || byName(a, b),
  };

  return [...scored].sort(comparators[sort]);
}

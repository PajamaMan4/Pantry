// Recipe recommendations (§3.8 / §5.5). Pure + tested. Given current inventory,
// score each recipe by ingredient coverage, surface near-misses, and sort by
// availability / soonest-expiring / lowest cost.
import { UNITS, type UnitCategory } from "./units";
import { daysUntil } from "./expiry";

export interface RecommendIngredient {
  ingredientId: number;
  amount: number | null;
  unit: string | null;
  optional: boolean;
  isStaple: boolean;
  density: number | null;
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

function availability(req: RecommendIngredient, stock: IngredientStock | undefined): Avail {
  if (!stock) return "missing"; // not in inventory at all
  if (req.amount == null || req.unit == null) return "have"; // non-numeric required → assume on hand
  const def = UNITS[req.unit];
  if (!def) return "unknown";

  const reqBase = req.amount * def.toBase;
  const same = stock.byCategory.get(def.category);
  if (same != null) return reqBase <= same + EPS ? "have" : "missing";

  // bridge volume <-> mass with density when categories differ
  if (req.density) {
    if (def.category === "volume" && stock.byCategory.has("mass")) {
      return reqBase * req.density <= stock.byCategory.get("mass")! + EPS ? "have" : "missing";
    }
    if (def.category === "mass" && stock.byCategory.has("volume")) {
      return reqBase / req.density <= stock.byCategory.get("volume")! + EPS ? "have" : "missing";
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
    // Staples are assumed available; optionals don't count against makeability.
    const required = recipe.ingredients.filter((i) => !i.optional && !i.isStaple);
    const missing: number[] = [];
    let unknownUnits = 0;
    for (const req of required) {
      const a = availability(req, stockMap.get(req.ingredientId));
      if (a === "missing") missing.push(req.ingredientId);
      else if (a === "unknown") {
        unknownUnits += 1;
        missing.push(req.ingredientId);
      }
    }
    const requiredCount = required.length;
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
      expiryUrgency: expiryScore(required, stockMap, now),
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

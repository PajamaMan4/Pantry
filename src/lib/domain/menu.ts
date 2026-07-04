// The Menu's combined ingredient list (§ Menu feature). Pure + tested. Given the
// ingredient lines of every recipe currently on the menu plus current inventory,
// sum each ingredient's quantity across recipes and decide whether there's enough
// in stock — reusing the exact ✅/❌ semantics the recipe cards already use.
import { combineAmounts } from "./units";
import { recommendRecipes, type RecommendIngredient, type InventoryStock } from "./recommend";

export type MenuIngredientRow = RecommendIngredient & { name: string };

export interface MenuIngredientLine {
  ingredientId: number;
  name: string;
  amount: number | null; // summed across recipes; null when every occurrence is non-numeric
  unit: string | null;
  inStock: boolean; // false => not enough on hand (or an unreconcilable unit)
}

/**
 * Collapse every menu recipe's ingredient lines into one row per ingredient,
 * summing quantities (via combineAmounts) and flagging in-stock status.
 * Staples and optional-only ingredients are treated as on hand, mirroring
 * recommendRecipes / the recipe-card badges. Lines are sorted by name.
 */
export function summarizeMenuIngredients(
  rows: MenuIngredientRow[],
  inventory: InventoryStock[],
  now: Date = new Date(),
): { lines: MenuIngredientLine[] } {
  if (rows.length === 0) return { lines: [] };

  // One synthetic "recipe" holding every menu ingredient line. recommendRecipes
  // groups by ingredient, sums via combineAmounts, and returns the missing set
  // (including unconvertible "unknowns") — exactly the availability logic used
  // elsewhere, so the Menu never diverges from the cards.
  const [result] = recommendRecipes([{ id: 0, name: "", ingredients: rows }], inventory, "available", new Map(), now);
  const missing = new Set(result.missing);

  const byIngredient = new Map<number, MenuIngredientRow[]>();
  for (const row of rows) {
    const arr = byIngredient.get(row.ingredientId) ?? [];
    arr.push(row);
    byIngredient.set(row.ingredientId, arr);
  }

  const lines: MenuIngredientLine[] = [];
  for (const [ingredientId, members] of byIngredient) {
    const first = members[0];
    const { amount, unit } = combineAmounts(members, first.density, first.gramsPerEach);
    lines.push({ ingredientId, name: first.name, amount, unit, inStock: !missing.has(ingredientId) });
  }
  lines.sort((a, b) => a.name.localeCompare(b.name));
  return { lines };
}

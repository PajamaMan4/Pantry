// The Menu's combined ingredient list (§ Menu feature). Pure + tested. Given the
// ingredient lines of every recipe currently on the menu plus current inventory,
// sum each ingredient's quantity across recipes and decide whether there's enough
// in stock — reusing the exact ✅/❌ semantics the recipe cards already use.
import { combineAmounts } from "./units";
import { scaleFactor, scaleIngredientAmount } from "./scaling";
import { buildInStockChecker, type RecommendIngredient, type InventoryStock } from "./recommend";
import type { LocationRef } from "./location-groups";

export type MenuIngredientRow = RecommendIngredient & {
  name: string;
  location?: LocationRef;
  category?: string | null;
};

/** A menu ingredient line still carrying its recipe's servings context. */
export type MenuRecipeIngredientRow = MenuIngredientRow & {
  baseServings: number;
  menuServings: number | null;
};

/**
 * Scale each row's amount to the recipe's chosen Menu servings
 * (menuServings ?? baseServings), returning plain MenuIngredientRows ready for
 * summarizeMenuIngredients. Approximate / non-numeric amounts pass through
 * unchanged via scaleIngredientAmount.
 */
export function scaleMenuRows(rows: MenuRecipeIngredientRow[]): MenuIngredientRow[] {
  return rows.map(({ baseServings, menuServings, amount, ...rest }) => {
    const factor = scaleFactor(baseServings, menuServings ?? baseServings);
    return { ...rest, amount: scaleIngredientAmount(amount, null, factor).amount };
  });
}

export interface MenuIngredientLine {
  ingredientId: number;
  name: string;
  amount: number | null; // summed across recipes; null when every occurrence is non-numeric
  unit: string | null;
  inStock: boolean; // false => not enough on hand (or an unreconcilable unit)
  location: LocationRef; // the ingredient's default storage location, if any
  category: string | null; // the ingredient's category, if any
}

/**
 * Collapse every menu recipe's ingredient lines into one row per ingredient,
 * summing quantities (via combineAmounts) and flagging in-stock status against
 * real inventory. Uses the same "should I buy this?" rule the recipe page's
 * ✅/❌ badge uses (staples on hand; a non-numeric amount needs some positive
 * stock; a numeric amount needs enough) — `optional` is irrelevant here, an
 * optional garnish you don't own still needs buying. Lines are sorted by name.
 */
export function summarizeMenuIngredients(
  rows: MenuIngredientRow[],
  inventory: InventoryStock[],
  _now: Date = new Date(),
): { lines: MenuIngredientLine[] } {
  if (rows.length === 0) return { lines: [] };

  const inStockOf = buildInStockChecker(inventory);

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
    lines.push({
      ingredientId,
      name: first.name,
      amount,
      unit,
      inStock: inStockOf({ ...first, amount, unit }),
      location: first.location ?? null,
      category: first.category ?? null,
    });
  }
  lines.sort((a, b) => a.name.localeCompare(b.name));
  return { lines };
}

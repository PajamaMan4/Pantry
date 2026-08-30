import { eq } from "drizzle-orm";
import { db } from "./client";
import { recipes, recipeIngredients, ingredients, inventoryItems, storageLocations } from "./schema";
import { summarizeMenuIngredients, scaleMenuRows, type MenuIngredientRow, type MenuIngredientLine } from "../domain/menu";
import type { InventoryStock } from "../domain/recommend";

/**
 * Joined ingredient lines for every recipe currently on the menu, with each
 * amount already scaled to the recipe's chosen Menu servings (menuServings ??
 * baseServings). Downstream consumers (the ingredient summary + the grocery
 * "add missing" action) therefore reflect how much the user plans to make.
 */
export function menuIngredientRows(): MenuIngredientRow[] {
  const rows = db
    .select({
      ingredientId: ingredients.id,
      name: ingredients.name,
      amount: recipeIngredients.amount,
      unit: recipeIngredients.unit,
      optional: recipeIngredients.optional,
      isStaple: ingredients.isStaple,
      density: ingredients.density,
      gramsPerEach: ingredients.gramsPerEach,
      baseServings: recipes.baseServings,
      menuServings: recipes.menuServings,
      locName: storageLocations.name,
      locSortOrder: storageLocations.sortOrder,
    })
    .from(recipeIngredients)
    .innerJoin(ingredients, eq(recipeIngredients.ingredientId, ingredients.id))
    .innerJoin(recipes, eq(recipeIngredients.recipeId, recipes.id))
    .leftJoin(storageLocations, eq(ingredients.defaultLocationId, storageLocations.id))
    .where(eq(recipes.isOnMenu, true))
    .all()
    .map(({ locName, locSortOrder, ...r }) => ({
      ...r,
      location: locName != null ? { name: locName, sortOrder: locSortOrder! } : null,
    }));

  return scaleMenuRows(rows);
}

/** All inventory stock, mapped to the domain's InventoryStock shape. */
export function loadInventoryStock(): InventoryStock[] {
  return db
    .select({ ingredientId: inventoryItems.ingredientId, quantity: inventoryItems.quantity, unit: inventoryItems.unit, expiryDate: inventoryItems.expiryDate })
    .from(inventoryItems)
    .all()
    .map((r) => ({ ingredientId: r.ingredientId, quantity: r.quantity, unit: r.unit, expiryMs: r.expiryDate?.getTime() ?? null }));
}

/** Combined, in-stock-flagged ingredient list for the whole menu. */
export function getMenuIngredientSummary(): { lines: MenuIngredientLine[] } {
  return summarizeMenuIngredients(menuIngredientRows(), loadInventoryStock(), new Date());
}

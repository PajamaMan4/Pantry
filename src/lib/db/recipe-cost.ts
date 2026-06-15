import { eq, inArray } from "drizzle-orm";
import { db } from "./client";
import { recipes, recipeIngredients, ingredients } from "./schema";
import { listPriceEntriesFor } from "./prices";
import { getSettings } from "./settings";
import {
  recipeCost,
  unitPrice,
  type CostIngredient,
  type RecipeCost,
  type PriceMode,
} from "../domain/cost";

/**
 * Compute the cost estimate for many recipes at once (used by the list/cards).
 * Resolves each ingredient's price-per-default-unit via the configured price
 * mode + window, then runs the pure cost calculator per recipe.
 */
export function recipeCostSummaries(recipeIds: number[]): Map<number, RecipeCost> {
  const result = new Map<number, RecipeCost>();
  if (recipeIds.length === 0) return result;

  const baseServingsById = new Map(
    db
      .select({ id: recipes.id, baseServings: recipes.baseServings })
      .from(recipes)
      .where(inArray(recipes.id, recipeIds))
      .all()
      .map((r) => [r.id, r.baseServings] as const),
  );

  const riRows = db
    .select({
      recipeId: recipeIngredients.recipeId,
      ingredientId: recipeIngredients.ingredientId,
      amount: recipeIngredients.amount,
      unit: recipeIngredients.unit,
      optional: recipeIngredients.optional,
      defaultUnit: ingredients.defaultUnit,
      density: ingredients.density,
    })
    .from(recipeIngredients)
    .innerJoin(ingredients, eq(recipeIngredients.ingredientId, ingredients.id))
    .where(inArray(recipeIngredients.recipeId, recipeIds))
    .all();

  // Price-per-default-unit for each distinct ingredient.
  const settings = getSettings();
  const mode: PriceMode = settings.priceMode === "current" ? "current" : "average";
  const now = new Date();
  const ingIds = [...new Set(riRows.map((r) => r.ingredientId))];
  const entriesByIng = listPriceEntriesFor(ingIds);
  const ingInfo = new Map<number, { defaultUnit: string | null; density: number | null }>();
  for (const r of riRows) {
    if (!ingInfo.has(r.ingredientId)) ingInfo.set(r.ingredientId, { defaultUnit: r.defaultUnit, density: r.density });
  }
  const priceByIng = new Map<number, number | null>();
  for (const id of ingIds) {
    const info = ingInfo.get(id)!;
    priceByIng.set(
      id,
      unitPrice(entriesByIng.get(id) ?? [], { defaultUnit: info.defaultUnit, density: info.density }, mode, settings.averageWindowMonths, now),
    );
  }

  const byRecipe = new Map<number, CostIngredient[]>();
  for (const r of riRows) {
    const arr = byRecipe.get(r.recipeId) ?? [];
    arr.push({ ingredientId: r.ingredientId, amount: r.amount, unit: r.unit, optional: r.optional, defaultUnit: r.defaultUnit, density: r.density });
    byRecipe.set(r.recipeId, arr);
  }

  for (const id of recipeIds) {
    result.set(id, recipeCost(byRecipe.get(id) ?? [], priceByIng, baseServingsById.get(id) ?? 1));
  }
  return result;
}

export function recipeCostFor(recipeId: number): RecipeCost | undefined {
  return recipeCostSummaries([recipeId]).get(recipeId);
}

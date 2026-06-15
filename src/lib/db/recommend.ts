import { eq } from "drizzle-orm";
import { db } from "./client";
import { recipes, recipeIngredients, ingredients, inventoryItems } from "./schema";
import { recipeCostSummaries } from "./recipe-cost";
import {
  recommendRecipes,
  type RecommendRecipe,
  type RecommendIngredient,
  type InventoryStock,
  type RecommendResult,
  type RecommendSort,
} from "../domain/recommend";

export function getRecommendations(
  sort: RecommendSort,
  now: Date = new Date(),
): { results: RecommendResult[]; ingredientNames: Map<number, string> } {
  const recipeRows = db.select({ id: recipes.id, name: recipes.name }).from(recipes).all();
  if (recipeRows.length === 0) return { results: [], ingredientNames: new Map() };

  const riRows = db
    .select({
      recipeId: recipeIngredients.recipeId,
      ingredientId: recipeIngredients.ingredientId,
      name: ingredients.name,
      amount: recipeIngredients.amount,
      unit: recipeIngredients.unit,
      optional: recipeIngredients.optional,
      isStaple: ingredients.isStaple,
      density: ingredients.density,
    })
    .from(recipeIngredients)
    .innerJoin(ingredients, eq(recipeIngredients.ingredientId, ingredients.id))
    .all();

  const ingredientNames = new Map<number, string>();
  const byRecipe = new Map<number, RecommendIngredient[]>();
  for (const r of riRows) {
    ingredientNames.set(r.ingredientId, r.name);
    const arr = byRecipe.get(r.recipeId) ?? [];
    arr.push({
      ingredientId: r.ingredientId,
      amount: r.amount,
      unit: r.unit,
      optional: r.optional,
      isStaple: r.isStaple,
      density: r.density,
    });
    byRecipe.set(r.recipeId, arr);
  }

  const recRecipes: RecommendRecipe[] = recipeRows.map((r) => ({
    id: r.id,
    name: r.name,
    ingredients: byRecipe.get(r.id) ?? [],
  }));

  const inventory: InventoryStock[] = db
    .select({
      ingredientId: inventoryItems.ingredientId,
      quantity: inventoryItems.quantity,
      unit: inventoryItems.unit,
      expiryDate: inventoryItems.expiryDate,
    })
    .from(inventoryItems)
    .all()
    .map((r) => ({ ingredientId: r.ingredientId, quantity: r.quantity, unit: r.unit, expiryMs: r.expiryDate?.getTime() ?? null }));

  // Per-serving cost — but only when there's real price data, so unpriced
  // recipes rank last under "cost" sort rather than appearing free.
  const costMap = recipeCostSummaries(recipeRows.map((r) => r.id));
  const costByRecipe = new Map<number, number | null>(
    recipeRows.map((r) => {
      const c = costMap.get(r.id);
      return [r.id, c && c.knownCount > 0 ? c.perServing : null];
    }),
  );

  const results = recommendRecipes(recRecipes, inventory, sort, costByRecipe, now);
  return { results, ingredientNames };
}

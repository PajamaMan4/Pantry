import { asc, eq, like, sql } from "drizzle-orm";
import { db } from "./client";
import {
  ingredients,
  recipeIngredients,
  recipes,
  inventoryItems,
  priceEntries,
  cookLogLines,
  shoppingListItems,
  type Ingredient,
  type PriceEntry,
} from "./schema";
import { listInventoryForIngredient } from "./inventory";
import { listPriceEntries } from "./prices";
import { repointStepIngredient } from "../domain/merge";

export function listIngredients(): Ingredient[] {
  return db.select().from(ingredients).orderBy(asc(ingredients.name)).all();
}

export function searchIngredients(query: string, limit = 12): Ingredient[] {
  const q = query.trim();
  const base = db.select().from(ingredients);
  if (!q) return base.orderBy(asc(ingredients.name)).limit(limit).all();
  return base
    .where(like(ingredients.name, `%${q}%`))
    .orderBy(asc(ingredients.name))
    .limit(limit)
    .all();
}

export function getIngredient(id: number): Ingredient | undefined {
  return db.select().from(ingredients).where(eq(ingredients.id, id)).get();
}

export type CreateIngredientInput = {
  name: string;
  category?: string | null;
  defaultUnit?: string | null;
  density?: number | null;
  isStaple?: boolean;
};

/**
 * Get an existing ingredient by case-insensitive name, or create it. This backs
 * the "Create '<name>'" create-on-the-fly path in the recipe editor typeahead
 * (§3.1) and keeps near-duplicate names from multiplying.
 */
export function getOrCreateIngredient(input: CreateIngredientInput): Ingredient {
  const name = input.name.trim();
  const existing = db
    .select()
    .from(ingredients)
    .where(sql`lower(${ingredients.name}) = lower(${name})`)
    .get();
  if (existing) return existing;

  return db
    .insert(ingredients)
    .values({
      name,
      category: input.category ?? null,
      defaultUnit: input.defaultUnit ?? null,
      density: input.density ?? null,
      isStaple: input.isStaple ?? false,
    })
    .returning()
    .get();
}

export type IngredientEditInput = {
  name: string;
  category: string | null;
  defaultUnit: string | null;
  density: number | null;
  isStaple: boolean;
};

export function updateIngredient(id: number, input: IngredientEditInput): Ingredient {
  return db
    .update(ingredients)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(ingredients.id, id))
    .returning()
    .get();
}

export type MergeResult = {
  movedRecipeRows: number;
  movedInventory: number;
  movedPrices: number;
};

/**
 * Merge `sourceId` into `targetId`: repoint every reference (recipe ingredients,
 * inventory, prices, cook-log lines, shopping items, and step-quantity links
 * inside recipe JSON) onto the target, then delete the source ingredient. Runs
 * in one transaction so a failure leaves the data untouched.
 */
export function mergeIngredients(sourceId: number, targetId: number): MergeResult {
  if (sourceId === targetId) throw new Error("Pick two different ingredients to merge.");

  return db.transaction((tx) => {
    const source = tx.select().from(ingredients).where(eq(ingredients.id, sourceId)).get();
    const target = tx.select().from(ingredients).where(eq(ingredients.id, targetId)).get();
    if (!source) throw new Error("The ingredient to merge no longer exists.");
    if (!target) throw new Error("The ingredient to keep no longer exists.");

    const movedRecipeRows = tx
      .update(recipeIngredients)
      .set({ ingredientId: targetId })
      .where(eq(recipeIngredients.ingredientId, sourceId))
      .run().changes;
    const movedInventory = tx
      .update(inventoryItems)
      .set({ ingredientId: targetId })
      .where(eq(inventoryItems.ingredientId, sourceId))
      .run().changes;
    const movedPrices = tx
      .update(priceEntries)
      .set({ ingredientId: targetId })
      .where(eq(priceEntries.ingredientId, sourceId))
      .run().changes;
    tx.update(cookLogLines)
      .set({ ingredientId: targetId })
      .where(eq(cookLogLines.ingredientId, sourceId))
      .run();
    tx.update(shoppingListItems)
      .set({ ingredientId: targetId })
      .where(eq(shoppingListItems.ingredientId, sourceId))
      .run();

    // Repoint step-quantity references embedded in recipe JSON.
    const allRecipes = tx.select({ id: recipes.id, steps: recipes.steps }).from(recipes).all();
    for (const r of allRecipes) {
      const { steps, changed } = repointStepIngredient(r.steps ?? [], sourceId, targetId);
      if (changed) {
        tx.update(recipes).set({ steps, updatedAt: new Date() }).where(eq(recipes.id, r.id)).run();
      }
    }

    tx.delete(ingredients).where(eq(ingredients.id, sourceId)).run();
    return { movedRecipeRows, movedInventory, movedPrices };
  });
}

/** Permanently delete an ingredient and everything that references it. */
export function deleteIngredient(id: number): void {
  db.transaction((tx) => {
    tx.delete(recipeIngredients).where(eq(recipeIngredients.ingredientId, id)).run();
    tx.delete(inventoryItems).where(eq(inventoryItems.ingredientId, id)).run();
    tx.delete(priceEntries).where(eq(priceEntries.ingredientId, id)).run();
    tx.delete(ingredients).where(eq(ingredients.id, id)).run();
  });
}

export type IngredientDetail = {
  ingredient: Ingredient;
  inventory: ReturnType<typeof listInventoryForIngredient>;
  recipes: { id: number; name: string }[];
  priceEntries: PriceEntry[];
};

export function getIngredientDetail(id: number): IngredientDetail | undefined {
  const ingredient = db.select().from(ingredients).where(eq(ingredients.id, id)).get();
  if (!ingredient) return undefined;

  const usedIn = db
    .selectDistinct({ id: recipes.id, name: recipes.name })
    .from(recipeIngredients)
    .innerJoin(recipes, eq(recipeIngredients.recipeId, recipes.id))
    .where(eq(recipeIngredients.ingredientId, id))
    .orderBy(asc(recipes.name))
    .all();

  return {
    ingredient,
    inventory: listInventoryForIngredient(id),
    recipes: usedIn,
    priceEntries: listPriceEntries(id),
  };
}

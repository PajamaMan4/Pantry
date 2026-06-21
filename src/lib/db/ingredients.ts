import { asc, eq, inArray, like, or, sql } from "drizzle-orm";
import { db } from "./client";
import {
  ingredients,
  ingredientAliases,
  recipeIngredients,
  recipes,
  inventoryItems,
  priceEntries,
  cookLogLines,
  shoppingListItems,
  type Ingredient,
  type IngredientAlias,
  type PriceEntry,
} from "./schema";
import { listInventoryForIngredient } from "./inventory";
import { listPriceEntries } from "./prices";
import { repointStepIngredient } from "../domain/merge";

export function listIngredients(): Ingredient[] {
  return db.select().from(ingredients).orderBy(asc(ingredients.name)).all();
}

export type IngredientWithAliases = Ingredient & { aliases: string[] };

export function listIngredientsWithAliases(): IngredientWithAliases[] {
  const all = db.select().from(ingredients).orderBy(asc(ingredients.name)).all();
  const aliasRows = db.select().from(ingredientAliases).all();
  const aliasMap = new Map<number, string[]>();
  for (const row of aliasRows) {
    const list = aliasMap.get(row.ingredientId) ?? [];
    list.push(row.alias);
    aliasMap.set(row.ingredientId, list);
  }
  return all.map((i) => ({ ...i, aliases: aliasMap.get(i.id) ?? [] }));
}

export function searchIngredients(query: string, limit = 12): Ingredient[] {
  const q = query.trim();
  if (!q) {
    return db.select().from(ingredients).orderBy(asc(ingredients.name)).limit(limit).all();
  }
  const pat = `%${q}%`;
  const byAlias = db
    .selectDistinct({ id: ingredientAliases.ingredientId })
    .from(ingredientAliases)
    .where(like(ingredientAliases.alias, pat))
    .all()
    .map((r) => r.id);

  const where =
    byAlias.length > 0
      ? or(like(ingredients.name, pat), inArray(ingredients.id, byAlias))
      : like(ingredients.name, pat);

  return db.select().from(ingredients).where(where).orderBy(asc(ingredients.name)).limit(limit).all();
}

export function getIngredient(id: number): Ingredient | undefined {
  return db.select().from(ingredients).where(eq(ingredients.id, id)).get();
}

export type CreateIngredientInput = {
  name: string;
  category?: string | null;
  defaultUnit?: string | null;
  density?: number | null;
  gramsPerEach?: number | null;
  isStaple?: boolean;
};

/**
 * Get an existing ingredient by case-insensitive name or alias, or create it.
 * Backs the "Create '<name>'" path in the recipe editor typeahead (§3.1) and
 * prevents near-duplicates from multiplying (e.g. "Eggs" → returns "Egg").
 */
export function getOrCreateIngredient(input: CreateIngredientInput): Ingredient {
  const name = input.name.trim();

  // 1. Exact name match (case-insensitive)
  const byName = db
    .select()
    .from(ingredients)
    .where(sql`lower(${ingredients.name}) = lower(${name})`)
    .get();
  if (byName) return byName;

  // 2. Alias match (case-insensitive)
  const byAlias = db
    .select({ ingredientId: ingredientAliases.ingredientId })
    .from(ingredientAliases)
    .where(sql`lower(${ingredientAliases.alias}) = lower(${name})`)
    .get();
  if (byAlias) {
    const aliased = db.select().from(ingredients).where(eq(ingredients.id, byAlias.ingredientId)).get();
    if (aliased) return aliased;
  }

  return db
    .insert(ingredients)
    .values({
      name,
      category: input.category ?? null,
      defaultUnit: input.defaultUnit ?? null,
      density: input.density ?? null,
      gramsPerEach: input.gramsPerEach ?? null,
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
  gramsPerEach: number | null;
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

// ---- Alias CRUD ----

export function listAliases(ingredientId: number): IngredientAlias[] {
  return db
    .select()
    .from(ingredientAliases)
    .where(eq(ingredientAliases.ingredientId, ingredientId))
    .orderBy(asc(ingredientAliases.alias))
    .all();
}

export function addAlias(ingredientId: number, alias: string): IngredientAlias {
  const trimmed = alias.trim();
  // Reject if already the canonical name (case-insensitive)
  const canonical = db.select().from(ingredients).where(eq(ingredients.id, ingredientId)).get();
  if (canonical && canonical.name.toLowerCase() === trimmed.toLowerCase()) {
    throw new Error("That's already the ingredient's name.");
  }
  // Reject if another ingredient has this name
  const conflictName = db
    .select()
    .from(ingredients)
    .where(sql`lower(${ingredients.name}) = lower(${trimmed})`)
    .get();
  if (conflictName) {
    throw new Error(`"${trimmed}" is already an ingredient name — use Merge instead.`);
  }
  // Reject if alias already exists on another ingredient
  const conflictAlias = db
    .select()
    .from(ingredientAliases)
    .where(sql`lower(${ingredientAliases.alias}) = lower(${trimmed})`)
    .get();
  if (conflictAlias) {
    if (conflictAlias.ingredientId === ingredientId) {
      throw new Error("That alias already exists for this ingredient.");
    }
    throw new Error("That alias is already used by another ingredient.");
  }
  return db.insert(ingredientAliases).values({ ingredientId, alias: trimmed }).returning().get();
}

export function removeAlias(id: number): void {
  db.delete(ingredientAliases).where(eq(ingredientAliases.id, id)).run();
}

// ---- Merge ----

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

    // Transfer source aliases to target, skipping any that conflict.
    const sourceAliases = tx
      .select()
      .from(ingredientAliases)
      .where(eq(ingredientAliases.ingredientId, sourceId))
      .all();
    const targetAliases = tx
      .select()
      .from(ingredientAliases)
      .where(eq(ingredientAliases.ingredientId, targetId))
      .all();
    const targetAliasSet = new Set(targetAliases.map((a) => a.alias.toLowerCase()));

    for (const sa of sourceAliases) {
      if (!targetAliasSet.has(sa.alias.toLowerCase())) {
        tx.update(ingredientAliases)
          .set({ ingredientId: targetId })
          .where(eq(ingredientAliases.id, sa.id))
          .run();
      }
    }

    // Add the source's canonical name as an alias for the target.
    if (
      source.name.toLowerCase() !== target.name.toLowerCase() &&
      !targetAliasSet.has(source.name.toLowerCase()) &&
      !sourceAliases.some((a) => a.alias.toLowerCase() === source.name.toLowerCase())
    ) {
      tx.insert(ingredientAliases).values({ ingredientId: targetId, alias: source.name }).run();
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
  aliases: IngredientAlias[];
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
    aliases: listAliases(id),
  };
}

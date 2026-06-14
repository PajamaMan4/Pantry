import { asc, eq, like, sql } from "drizzle-orm";
import { db } from "./client";
import {
  ingredients,
  recipeIngredients,
  recipes,
  type Ingredient,
  type PriceEntry,
} from "./schema";
import { listInventoryForIngredient } from "./inventory";
import { listPriceEntries } from "./prices";

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

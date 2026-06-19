import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { db } from "./client";
import {
  ingredients,
  recipeIngredients,
  recipeTags,
  recipes,
  tags,
  type Ingredient,
  type Recipe,
  type RecipeIngredient,
  type Step,
  type Tag,
} from "./schema";
import { lastCookedByRecipe } from "./cook";
import { recipeCostSummaries } from "./recipe-cost";
import type { RecipeCost } from "../domain/cost";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ---- Input shape used by create/update (already validated by Zod) -----------
export type RecipeIngredientInput = {
  ingredientId: number | null;
  name?: string | null; // used when ingredientId is null (create-on-the-fly)
  amount: number | null;
  amountMax: number | null;
  unit: string | null;
  raw: string | null;
  prep: string | null;
  optional: boolean;
  sectionTitle?: string | null; // optional grouping label for multi-part recipes
};

export type RecipeWriteInput = {
  name: string;
  description: string | null;
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  baseServings: number;
  notes: string | null;
  isFavorite: boolean;
  tags: string[];
  ingredients: RecipeIngredientInput[];
  steps: Step[];
};

// ---- Read shapes ------------------------------------------------------------
export type RecipeListItem = { recipe: Recipe; tags: Tag[]; lastCookedAt: Date | null; cost: RecipeCost };

export type RecipeIngredientDetail = RecipeIngredient & {
  ingredient: Pick<Ingredient, "id" | "name" | "defaultUnit" | "category" | "density">;
};

export type RecipeDetail = {
  recipe: Recipe;
  ingredients: RecipeIngredientDetail[];
  tags: Tag[];
};

export type RecipeListFilters = {
  search?: string;
  tagIds?: number[];
  ingredientId?: number;
  maxTotalTimeMin?: number;
  favoritesOnly?: boolean;
};

// ---- Queries ----------------------------------------------------------------
export function listRecipes(filters: RecipeListFilters = {}): RecipeListItem[] {
  const conds = [];
  const q = filters.search?.trim();
  if (q) {
    conds.push(or(like(recipes.name, `%${q}%`), like(recipes.description, `%${q}%`)));
  }
  if (filters.favoritesOnly) conds.push(eq(recipes.isFavorite, true));
  if (filters.maxTotalTimeMin != null) {
    conds.push(
      sql`(coalesce(${recipes.prepTimeMin}, 0) + coalesce(${recipes.cookTimeMin}, 0)) <= ${filters.maxTotalTimeMin}`,
    );
  }
  if (filters.tagIds && filters.tagIds.length > 0) {
    for (const tagId of filters.tagIds) {
      conds.push(
        sql`EXISTS (SELECT 1 FROM ${recipeTags} rt WHERE rt.recipe_id = ${recipes.id} AND rt.tag_id = ${tagId})`,
      );
    }
  }
  if (filters.ingredientId != null) {
    conds.push(
      sql`EXISTS (SELECT 1 FROM ${recipeIngredients} ri WHERE ri.recipe_id = ${recipes.id} AND ri.ingredient_id = ${filters.ingredientId})`,
    );
  }

  const where = conds.length ? and(...conds) : undefined;
  const recipeRows = db
    .select()
    .from(recipes)
    .where(where)
    .orderBy(desc(recipes.isFavorite), asc(recipes.name))
    .all();

  if (recipeRows.length === 0) return [];

  // Fetch all tags for the matched recipes in one query, then group.
  const ids = recipeRows.map((r) => r.id);
  const tagRows = db
    .select({ recipeId: recipeTags.recipeId, tag: tags })
    .from(recipeTags)
    .innerJoin(tags, eq(recipeTags.tagId, tags.id))
    .where(inArray(recipeTags.recipeId, ids))
    .orderBy(asc(tags.name))
    .all();

  const tagsByRecipe = new Map<number, Tag[]>();
  for (const row of tagRows) {
    const list = tagsByRecipe.get(row.recipeId) ?? [];
    list.push(row.tag);
    tagsByRecipe.set(row.recipeId, list);
  }

  const lastCooked = lastCookedByRecipe(ids);
  const costByRecipe = recipeCostSummaries(ids);
  const emptyCost: RecipeCost = {
    total: 0,
    perServing: 0,
    lines: [],
    unknownIngredientIds: [],
    knownCount: 0,
    countedCount: 0,
  };

  return recipeRows.map((recipe) => ({
    recipe,
    tags: tagsByRecipe.get(recipe.id) ?? [],
    lastCookedAt: lastCooked.get(recipe.id) ?? null,
    cost: costByRecipe.get(recipe.id) ?? emptyCost,
  }));
}

export function getRecipeDetail(id: number): RecipeDetail | undefined {
  const recipe = db.select().from(recipes).where(eq(recipes.id, id)).get();
  if (!recipe) return undefined;

  const ingRows = db
    .select({ ri: recipeIngredients, ing: ingredients })
    .from(recipeIngredients)
    .innerJoin(ingredients, eq(recipeIngredients.ingredientId, ingredients.id))
    .where(eq(recipeIngredients.recipeId, id))
    .orderBy(asc(recipeIngredients.displayOrder))
    .all();

  const detailIngredients: RecipeIngredientDetail[] = ingRows.map(({ ri, ing }) => ({
    ...ri,
    ingredient: {
      id: ing.id,
      name: ing.name,
      defaultUnit: ing.defaultUnit,
      category: ing.category,
      density: ing.density,
    },
  }));

  const tagRows = db
    .select({ tag: tags })
    .from(recipeTags)
    .innerJoin(tags, eq(recipeTags.tagId, tags.id))
    .where(eq(recipeTags.recipeId, id))
    .orderBy(asc(tags.name))
    .all();

  return { recipe, ingredients: detailIngredients, tags: tagRows.map((t) => t.tag) };
}

// ---- Mutations --------------------------------------------------------------
function resolveIngredientId(tx: Tx, row: RecipeIngredientInput): number {
  if (row.ingredientId != null) return row.ingredientId;
  const name = (row.name ?? "").trim();
  if (!name) throw new Error("Ingredient row is missing both an id and a name.");

  const existing = tx
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(sql`lower(${ingredients.name}) = lower(${name})`)
    .get();
  if (existing) return existing.id;

  return tx
    .insert(ingredients)
    .values({ name, defaultUnit: row.unit ?? null })
    .returning({ id: ingredients.id })
    .get().id;
}

function getOrCreateTagId(tx: Tx, name: string): number {
  const n = name.trim();
  const existing = tx
    .select({ id: tags.id })
    .from(tags)
    .where(sql`lower(${tags.name}) = lower(${n})`)
    .get();
  if (existing) return existing.id;
  return tx.insert(tags).values({ name: n }).returning({ id: tags.id }).get().id;
}

function writeIngredients(tx: Tx, recipeId: number, rows: RecipeIngredientInput[]): void {
  if (rows.length === 0) return;
  tx.insert(recipeIngredients)
    .values(
      rows.map((row, i) => ({
        recipeId,
        ingredientId: resolveIngredientId(tx, row),
        amount: row.amount,
        amountMax: row.amountMax,
        unit: row.unit,
        raw: row.raw,
        prep: row.prep,
        optional: row.optional,
        sectionTitle: row.sectionTitle ?? null,
        displayOrder: i,
      })),
    )
    .run();
}

function writeTags(tx: Tx, recipeId: number, tagNames: string[]): void {
  const seen = new Set<number>();
  for (const name of tagNames) {
    if (!name.trim()) continue;
    const tagId = getOrCreateTagId(tx, name);
    if (seen.has(tagId)) continue;
    seen.add(tagId);
    tx.insert(recipeTags).values({ recipeId, tagId }).run();
  }
}

export function createRecipe(input: RecipeWriteInput): number {
  return db.transaction((tx) => {
    const recipe = tx
      .insert(recipes)
      .values({
        name: input.name,
        description: input.description,
        steps: input.steps,
        prepTimeMin: input.prepTimeMin,
        cookTimeMin: input.cookTimeMin,
        baseServings: input.baseServings,
        notes: input.notes,
        isFavorite: input.isFavorite,
      })
      .returning({ id: recipes.id })
      .get();

    writeIngredients(tx, recipe.id, input.ingredients);
    writeTags(tx, recipe.id, input.tags);
    return recipe.id;
  });
}

export function updateRecipe(id: number, input: RecipeWriteInput): void {
  db.transaction((tx) => {
    tx.update(recipes)
      .set({
        name: input.name,
        description: input.description,
        steps: input.steps,
        prepTimeMin: input.prepTimeMin,
        cookTimeMin: input.cookTimeMin,
        baseServings: input.baseServings,
        notes: input.notes,
        isFavorite: input.isFavorite,
        updatedAt: new Date(),
      })
      .where(eq(recipes.id, id))
      .run();

    // Replace children wholesale — simplest correct approach at this scale.
    tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id)).run();
    tx.delete(recipeTags).where(eq(recipeTags.recipeId, id)).run();
    writeIngredients(tx, id, input.ingredients);
    writeTags(tx, id, input.tags);
  });
}

export function deleteRecipe(id: number): void {
  // recipe_ingredients / recipe_tags cascade via FK (foreign_keys pragma is ON).
  db.delete(recipes).where(eq(recipes.id, id)).run();
}

export function setFavorite(id: number, value: boolean): void {
  db.update(recipes)
    .set({ isFavorite: value, updatedAt: new Date() })
    .where(eq(recipes.id, id))
    .run();
}

export function setRating(id: number, rating: number | null): void {
  db.update(recipes)
    .set({ rating, updatedAt: new Date() })
    .where(eq(recipes.id, id))
    .run();
}

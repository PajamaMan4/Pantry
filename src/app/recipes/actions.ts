"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recipeInputSchema } from "@/lib/validation/recipe";
import { ingredientInputSchema } from "@/lib/validation/ingredient";
import {
  createRecipe,
  updateRecipe,
  deleteRecipe,
  setFavorite,
  setRating,
  type RecipeWriteInput,
} from "@/lib/db/recipes";
import { getOrCreateIngredient } from "@/lib/db/ingredients";
import { getSubstituteInfo, type SubstituteInfo } from "@/lib/db/cook";
import type { Ingredient } from "@/lib/db/schema";

export type RecipeFormError = { ok: false; error: string };

function firstError(issues: { message: string }[]): string {
  return issues[0]?.message ?? "Please check the form and try again.";
}

// On success these redirect (which throws), so they only *return* on failure.
export async function createRecipeAction(input: unknown): Promise<RecipeFormError> {
  const parsed = recipeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };

  const id = createRecipe(parsed.data as RecipeWriteInput);
  revalidatePath("/recipes");
  redirect(`/recipes/${id}`);
}

export async function updateRecipeAction(id: number, input: unknown): Promise<RecipeFormError> {
  const parsed = recipeInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };

  updateRecipe(id, parsed.data as RecipeWriteInput);
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
  redirect(`/recipes/${id}`);
}

export async function deleteRecipeAction(id: number): Promise<void> {
  deleteRecipe(id);
  revalidatePath("/recipes");
  redirect("/recipes");
}

export async function toggleFavoriteAction(id: number, value: boolean): Promise<{ ok: true }> {
  setFavorite(id, value);
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
  return { ok: true };
}

export async function setRatingAction(id: number, rating: number | null): Promise<{ ok: true }> {
  setRating(id, rating == null ? null : Math.max(1, Math.min(5, Math.round(rating))));
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
  return { ok: true };
}

export type CreateIngredientResult =
  | { ok: true; ingredient: Ingredient }
  | { ok: false; error: string };

export async function createIngredientAction(input: unknown): Promise<CreateIngredientResult> {
  const parsed = ingredientInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  const ingredient = getOrCreateIngredient(parsed.data);
  revalidatePath("/recipes");
  return { ok: true, ingredient };
}

export type SubstituteInfoResult =
  | { ok: true; info: SubstituteInfo }
  | { ok: false; error: string };

/** Look up a substitute ingredient's conversion + stock data for a temporary swap. */
export async function getSubstituteInfoAction(ingredientId: number): Promise<SubstituteInfoResult> {
  if (!Number.isInteger(ingredientId)) return { ok: false, error: "Invalid ingredient." };
  const info = getSubstituteInfo(ingredientId);
  if (!info) return { ok: false, error: "Ingredient not found." };
  return { ok: true, info };
}

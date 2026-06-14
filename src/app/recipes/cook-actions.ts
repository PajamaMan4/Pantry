"use server";

import { revalidatePath } from "next/cache";
import { cookInputSchema } from "@/lib/validation/cook";
import { cookThisRecipe, undoCook } from "@/lib/db/cook";

export type CookActionResult =
  | { ok: true; cookLogId: number; deducted: number; warnings: string[] }
  | { ok: false; error: string };

function revalidateAll(recipeId: number): void {
  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath("/recipes");
  revalidatePath("/ingredients");
  revalidatePath("/ingredients/[id]", "page");
}

export async function cookThisRecipeAction(
  recipeId: number,
  servingsMade: unknown,
): Promise<CookActionResult> {
  const parsed = cookInputSchema.safeParse({ servingsMade });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid servings" };

  const res = cookThisRecipe(recipeId, parsed.data.servingsMade);
  if (!res.ok) return { ok: false, error: res.error };

  revalidateAll(recipeId);
  return { ok: true, cookLogId: res.cookLogId, deducted: res.plan.deductions.length, warnings: res.plan.warnings };
}

export async function undoCookAction(cookLogId: number, recipeId: number): Promise<{ ok: true }> {
  undoCook(cookLogId);
  revalidateAll(recipeId);
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { cookInputSchema, cookSubstitutionsSchema } from "@/lib/validation/cook";
import { cookThisRecipe, undoCook } from "@/lib/db/cook";
import { getMenuState, setOnMenu, setMenuServings } from "@/lib/db/recipes";

export type CookActionResult =
  | {
      ok: true;
      cookLogId: number;
      deducted: number;
      warnings: string[];
      /** Set when the recipe was on the Menu and got removed; lets Undo put it back. */
      prevMenu: { menuServings: number | null } | null;
    }
  | { ok: false; error: string };

function revalidateAll(recipeId: number): void {
  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath("/recipes");
  revalidatePath("/menu");
  revalidatePath("/ingredients");
  revalidatePath("/ingredients/[id]", "page");
}

export async function cookThisRecipeAction(
  recipeId: number,
  servingsMade: unknown,
  substitutions?: unknown,
): Promise<CookActionResult> {
  const parsed = cookInputSchema.safeParse({ servingsMade });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid servings" };

  const parsedSubs = cookSubstitutionsSchema.safeParse(substitutions ?? []);
  if (!parsedSubs.success) return { ok: false, error: "Invalid substitutions" };

  const res = cookThisRecipe(recipeId, parsed.data.servingsMade, parsedSubs.data);
  if (!res.ok) return { ok: false, error: res.error };

  // Having made it, the recipe no longer belongs on the Menu (also resets custom servings).
  // Report the prior state so Undo can restore it.
  const prev = getMenuState(recipeId);
  const wasOnMenu = prev?.isOnMenu ?? false;
  if (wasOnMenu) {
    setOnMenu(recipeId, false);
    setMenuServings(recipeId, null);
  }

  revalidateAll(recipeId);
  return {
    ok: true,
    cookLogId: res.cookLogId,
    deducted: res.plan.deductions.length,
    warnings: res.plan.warnings,
    prevMenu: wasOnMenu ? { menuServings: prev?.menuServings ?? null } : null,
  };
}

export async function undoCookAction(
  cookLogId: number,
  recipeId: number,
  prevMenu: { menuServings: number | null } | null = null,
): Promise<{ ok: true }> {
  undoCook(cookLogId);
  if (prevMenu) {
    setOnMenu(recipeId, true);
    setMenuServings(recipeId, prevMenu.menuServings);
  }
  revalidateAll(recipeId);
  return { ok: true };
}

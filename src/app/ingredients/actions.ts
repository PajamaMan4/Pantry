"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ingredientEditSchema, ingredientInputSchema } from "@/lib/validation/ingredient";
import { priceEntrySchema } from "@/lib/validation/inventory";
import { updateIngredient, getOrCreateIngredient } from "@/lib/db/ingredients";
import { createPriceEntry, deletePriceEntry } from "@/lib/db/prices";

export type IngredientActionResult = { ok: true } | { ok: false; error: string };

function firstError(issues: { message: string }[]): string {
  return issues[0]?.message ?? "Please check the form and try again.";
}

export async function createIngredientFullAction(input: unknown): Promise<IngredientActionResult> {
  const parsed = ingredientInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  const ingredient = getOrCreateIngredient(parsed.data);
  revalidatePath("/ingredients");
  redirect(`/ingredients/${ingredient.id}`);
}

export async function updateIngredientAction(
  id: number,
  input: unknown,
): Promise<IngredientActionResult> {
  const parsed = ingredientEditSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  updateIngredient(id, parsed.data);
  revalidatePath(`/ingredients/${id}`);
  revalidatePath("/inventory");
  return { ok: true };
}

export async function addPriceAction(
  ingredientId: number,
  input: unknown,
): Promise<IngredientActionResult> {
  const parsed = priceEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  createPriceEntry({ ingredientId, ...parsed.data });
  revalidatePath(`/ingredients/${ingredientId}`);
  revalidatePath("/inventory");
  return { ok: true };
}

export async function deletePriceEntryAction(
  id: number,
  ingredientId: number,
): Promise<{ ok: true }> {
  deletePriceEntry(id);
  revalidatePath(`/ingredients/${ingredientId}`);
  revalidatePath("/inventory");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { shoppingItemSchema } from "@/lib/validation/shopping";
import {
  addShoppingItem,
  updateShoppingItem,
  setShoppingChecked,
  deleteShoppingItem,
  clearCheckedShoppingItems,
  receiveCheckedShoppingItems,
  addMissingForRecipe,
} from "@/lib/db/shopping";

export type ShoppingActionResult = { ok: true } | { ok: false; error: string };

function firstError(issues: { message: string }[]): string {
  return issues[0]?.message ?? "Please check the form and try again.";
}

export async function addShoppingItemAction(input: unknown): Promise<ShoppingActionResult> {
  const parsed = shoppingItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  addShoppingItem(parsed.data);
  revalidatePath("/shopping");
  return { ok: true };
}

export async function updateShoppingItemAction(id: number, input: unknown): Promise<ShoppingActionResult> {
  const parsed = shoppingItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  updateShoppingItem(id, parsed.data);
  revalidatePath("/shopping");
  return { ok: true };
}

export async function toggleShoppingItemAction(id: number, checked: boolean): Promise<{ ok: true }> {
  setShoppingChecked(id, checked);
  revalidatePath("/shopping");
  return { ok: true };
}

export async function deleteShoppingItemAction(id: number): Promise<{ ok: true }> {
  deleteShoppingItem(id);
  revalidatePath("/shopping");
  return { ok: true };
}

export async function clearCheckedAction(): Promise<{ ok: true }> {
  clearCheckedShoppingItems();
  revalidatePath("/shopping");
  return { ok: true };
}

export async function receiveCheckedAction(): Promise<{ ok: true; added: number }> {
  const { added } = receiveCheckedShoppingItems();
  revalidatePath("/shopping");
  revalidatePath("/ingredients");
  revalidatePath("/ingredients/[id]", "page");
  return { ok: true, added };
}

export async function addMissingForRecipeAction(recipeId: number): Promise<{ ok: true; added: number }> {
  const added = addMissingForRecipe(recipeId);
  revalidatePath("/shopping");
  return { ok: true, added };
}

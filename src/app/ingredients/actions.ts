"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ingredientEditSchema, ingredientInputSchema } from "@/lib/validation/ingredient";
import {
  priceEntrySchema,
  inventoryItemSchema,
  logPurchaseSchema,
} from "@/lib/validation/inventory";
import { inventoryViewSchema } from "@/lib/validation/settings";
import {
  updateIngredient,
  getOrCreateIngredient,
  deleteIngredient,
  mergeIngredients,
  addAlias,
  removeAlias,
} from "@/lib/db/ingredients";
import { createPriceEntry, deletePriceEntry } from "@/lib/db/prices";
import {
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  clearInventoryForIngredient,
  logPurchase,
  type InventoryItemInput,
  type LogPurchaseInput,
} from "@/lib/db/inventory";
import { setInventoryView } from "@/lib/db/settings";

export type IngredientActionResult = { ok: true } | { ok: false; error: string };

function firstError(issues: { message: string }[]): string {
  return issues[0]?.message ?? "Please check the form and try again.";
}

function revalidateIngredients(): void {
  revalidatePath("/ingredients");
  revalidatePath("/ingredients/[id]", "page");
}

// ---- ingredient ----
export async function createIngredientFullAction(input: unknown): Promise<IngredientActionResult> {
  const parsed = ingredientInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  const ingredient = getOrCreateIngredient(parsed.data);
  revalidatePath("/ingredients");
  redirect(`/ingredients/${ingredient.id}`);
}

export async function updateIngredientAction(id: number, input: unknown): Promise<IngredientActionResult> {
  const parsed = ingredientEditSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  updateIngredient(id, parsed.data);
  revalidateIngredients();
  return { ok: true };
}

export async function deleteIngredientAction(id: number): Promise<void> {
  deleteIngredient(id);
  revalidatePath("/ingredients");
  redirect("/ingredients");
}

// Merge `sourceId` into `targetId`; on success redirect to the kept ingredient.
export async function mergeIngredientAction(
  sourceId: number,
  targetId: number,
): Promise<IngredientActionResult> {
  try {
    mergeIngredients(sourceId, targetId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't merge ingredients." };
  }
  revalidatePath("/ingredients");
  revalidatePath("/recipes");
  revalidatePath("/recipes/[id]", "page");
  redirect(`/ingredients/${targetId}`);
}

// ---- aliases ----
export async function addAliasAction(ingredientId: number, alias: string): Promise<IngredientActionResult> {
  const trimmed = alias.trim();
  if (!trimmed) return { ok: false, error: "Alias cannot be empty." };
  if (trimmed.length > 200) return { ok: false, error: "Alias is too long." };
  try {
    addAlias(ingredientId, trimmed);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not add alias." };
  }
  revalidateIngredients();
  return { ok: true };
}

export async function removeAliasAction(id: number): Promise<{ ok: true }> {
  removeAlias(id);
  revalidateIngredients();
  return { ok: true };
}

export async function clearStockAction(ingredientId: number): Promise<{ ok: true }> {
  clearInventoryForIngredient(ingredientId);
  revalidateIngredients();
  return { ok: true };
}

// ---- price entries ----
export async function addPriceAction(ingredientId: number, input: unknown): Promise<IngredientActionResult> {
  const parsed = priceEntrySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  createPriceEntry({ ingredientId, ...parsed.data });
  revalidateIngredients();
  return { ok: true };
}

export async function deletePriceEntryAction(id: number): Promise<{ ok: true }> {
  deletePriceEntry(id);
  revalidateIngredients();
  return { ok: true };
}

// ---- inventory items ----
export async function createInventoryItemAction(input: unknown): Promise<IngredientActionResult> {
  const parsed = inventoryItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  createInventoryItem(parsed.data as InventoryItemInput);
  revalidateIngredients();
  return { ok: true };
}

export async function updateInventoryItemAction(id: number, input: unknown): Promise<IngredientActionResult> {
  const parsed = inventoryItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  updateInventoryItem(id, parsed.data as InventoryItemInput);
  revalidateIngredients();
  return { ok: true };
}

export async function deleteInventoryItemAction(id: number): Promise<{ ok: true }> {
  deleteInventoryItem(id);
  revalidateIngredients();
  return { ok: true };
}

export async function logPurchaseAction(input: unknown): Promise<IngredientActionResult> {
  const parsed = logPurchaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  logPurchase(parsed.data as LogPurchaseInput);
  revalidateIngredients();
  return { ok: true };
}

// ---- view preference ----
export async function setInventoryViewAction(view: unknown): Promise<{ ok: true }> {
  const parsed = inventoryViewSchema.safeParse(view);
  if (parsed.success) {
    setInventoryView(parsed.data);
    revalidatePath("/ingredients");
  }
  return { ok: true };
}

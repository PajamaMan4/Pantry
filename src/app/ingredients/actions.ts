"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ingredientEditSchema, ingredientInputSchema } from "@/lib/validation/ingredient";
import { z } from "zod";
import {
  priceEntrySchema,
  inventoryItemSchema,
  inventoryRemoveSchema,
  inventoryEditSchema,
  logPurchaseSchema,
} from "@/lib/validation/inventory";
import { idOrNull } from "@/lib/validation/common";
import { importItemSchema, normalizeImportItemList } from "@/lib/inventory-import";
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
  setInventoryLocation,
  clearInventoryForIngredient,
  decrementInventoryItems,
  importPricesAndInventory,
  logPurchase,
  applyInventoryEdits,
  type InventoryItemInput,
  type LogPurchaseInput,
} from "@/lib/db/inventory";
import type { InventoryEditPayload } from "@/lib/domain/inventory-edit";
import { listLocations, getOrCreateLocation } from "@/lib/db/locations";
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

/** Resolve a location id/name pair from an ingredient form into a plain id,
 * creating the location on the fly if only a name was typed. */
function resolveDefaultLocationId(input: {
  defaultLocationId: number | null;
  defaultLocationName: string | null;
}): number | null {
  return input.defaultLocationId ?? (input.defaultLocationName ? getOrCreateLocation(input.defaultLocationName).id : null);
}

export async function createIngredientFullAction(input: unknown): Promise<IngredientActionResult> {
  const parsed = ingredientInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  const { defaultLocationName, ...rest } = parsed.data;
  const defaultLocationId = resolveDefaultLocationId({ defaultLocationId: rest.defaultLocationId, defaultLocationName });
  const ingredient = getOrCreateIngredient({ ...rest, defaultLocationId });
  revalidatePath("/ingredients");
  redirect(`/ingredients/${ingredient.id}`);
}

export async function updateIngredientAction(id: number, input: unknown): Promise<IngredientActionResult> {
  const parsed = ingredientEditSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  const { defaultLocationName, ...rest } = parsed.data;
  const defaultLocationId = resolveDefaultLocationId({ defaultLocationId: rest.defaultLocationId, defaultLocationName });
  updateIngredient(id, { ...rest, defaultLocationId });
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

// Merge multiple sourceIds into targetId; on success redirect to the kept ingredient.
export async function mergeManyIngredientsAction(
  sourceIds: number[],
  targetId: number,
): Promise<IngredientActionResult> {
  for (const sourceId of sourceIds) {
    try {
      mergeIngredients(sourceId, targetId);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Couldn't merge ingredients." };
    }
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

// Move an entry to another storage location (null = Unsorted). Used by the
// drag-to-sort tray, which only ever sends ids it was rendered with — the
// existence check catches a tray left open while the location was deleted.
export async function moveInventoryItemAction(
  id: number,
  locationId: number | null,
): Promise<IngredientActionResult> {
  const parsed = idOrNull.safeParse(locationId);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  const target = parsed.data as number | null;
  if (target != null && !listLocations().some((l) => l.id === target)) {
    return { ok: false, error: "That location no longer exists." };
  }
  setInventoryLocation(id, target);
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

// ---- bulk add / remove ----
const bulkAddSchema = z.array(importItemSchema).min(1, "Add at least one item.");

export async function addInventoryBulkAction(rows: unknown): Promise<IngredientActionResult> {
  const parsed = bulkAddSchema.safeParse(rows);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  importPricesAndInventory(normalizeImportItemList(parsed.data));
  revalidateIngredients();
  return { ok: true };
}

export async function removeInventoryBulkAction(lines: unknown): Promise<IngredientActionResult> {
  const parsed = inventoryRemoveSchema.safeParse(lines);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  decrementInventoryItems(parsed.data);
  revalidateIngredients();
  return { ok: true };
}

// Commit for the bulk Inventory Edit page: applies a diff (computed client-side
// from the editor's draft state) in one transaction. See applyInventoryEdits.
export async function saveInventoryEditsAction(payload: unknown): Promise<IngredientActionResult> {
  const parsed = inventoryEditSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error.issues) };
  try {
    applyInventoryEdits(parsed.data as InventoryEditPayload);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't save inventory changes." };
  }
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

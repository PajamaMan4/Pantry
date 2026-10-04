"use server";

import { revalidatePath } from "next/cache";
import { settingsUpdateSchema, anthropicKeySchema, listGroupingSchema } from "@/lib/validation/settings";
import { locationNameSchema } from "@/lib/validation/location";
import {
  updateSettings,
  setAnthropicApiKey,
  resolveAnthropicApiKey,
  setHasSeenWelcome,
  setListGrouping,
} from "@/lib/db/settings";
import { createLocation, renameLocation, deleteLocation } from "@/lib/db/locations";
import { tagNameSchema, categoryNameSchema } from "@/lib/validation/taxonomy";
import { findTagByName, renameTag, mergeTag, deleteTag } from "@/lib/db/tags";
import { listCategories, renameCategory, deleteCategory } from "@/lib/db/ingredients";

export type SaveSettingsResult =
  | { ok: true; savedAt: number }
  | { ok: false; error: string };

export type SaveApiKeyResult =
  | { ok: true; hasKey: boolean }
  | { ok: false; error: string };

export type LocationActionResult = { ok: true } | { ok: false; error: string };
export type CreateLocationResult =
  | { ok: true; location: { id: number; name: string } }
  | { ok: false; error: string };

function revalidateLocations(): void {
  revalidatePath("/settings");
  revalidatePath("/ingredients");
  revalidatePath("/ingredients/[id]", "page");
}

export async function createLocationAction(input: unknown): Promise<CreateLocationResult> {
  const parsed = locationNameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name" };
  const location = createLocation(parsed.data.name);
  revalidateLocations();
  return { ok: true, location: { id: location.id, name: location.name } };
}

export async function renameLocationAction(id: number, input: unknown): Promise<LocationActionResult> {
  const parsed = locationNameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name" };
  renameLocation(id, parsed.data.name);
  revalidateLocations();
  return { ok: true };
}

export async function deleteLocationAction(id: number): Promise<{ ok: true }> {
  deleteLocation(id);
  revalidateLocations();
  return { ok: true };
}

export type TaxonomyActionResult = { ok: true; count?: number } | { ok: false; error: string };

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

function revalidateTags(): void {
  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/recipes");
  revalidatePath("/recipes/new");
  revalidatePath("/recipes/[id]", "page");
  revalidatePath("/recipes/[id]/edit", "page");
}

function revalidateCategories(): void {
  revalidatePath("/settings");
  revalidatePath("/ingredients");
  revalidatePath("/ingredients/new");
  revalidatePath("/ingredients/[id]", "page");
  revalidatePath("/ingredients/inventory/edit");
  revalidatePath("/shopping");
  revalidatePath("/menu");
}

export async function renameTagAction(id: number, input: unknown): Promise<TaxonomyActionResult> {
  const parsed = tagNameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name" };
  const clash = findTagByName(parsed.data.name);
  if (clash && clash.id !== id) {
    return { ok: false, error: `“${clash.name}” already exists. Use Merge to combine them.` };
  }
  renameTag(id, parsed.data.name);
  revalidateTags();
  return { ok: true };
}

export async function mergeTagAction(sourceId: number, targetId: number): Promise<TaxonomyActionResult> {
  if (sourceId === targetId) return { ok: false, error: "Pick a different tag to merge into." };
  const count = mergeTag(sourceId, targetId);
  revalidateTags();
  return { ok: true, count };
}

export async function deleteTagAction(id: number): Promise<TaxonomyActionResult> {
  deleteTag(id);
  revalidateTags();
  return { ok: true };
}

export async function renameCategoryAction(from: string, input: unknown): Promise<TaxonomyActionResult> {
  const parsed = categoryNameSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name" };
  // Renaming onto a *different* existing category is a merge, so make that explicit.
  const clash = listCategories().find((c) => sameName(c, parsed.data.name) && !sameName(c, from));
  if (clash) return { ok: false, error: `“${clash}” already exists. Use Merge to combine them.` };
  const count = renameCategory(from, parsed.data.name);
  revalidateCategories();
  return { ok: true, count };
}

export async function mergeCategoryAction(from: string, to: string): Promise<TaxonomyActionResult> {
  if (sameName(from, to)) return { ok: false, error: "Pick a different category to merge into." };
  const target = listCategories().find((c) => sameName(c, to));
  if (!target) return { ok: false, error: "That category no longer exists." };
  const count = renameCategory(from, target);
  revalidateCategories();
  return { ok: true, count };
}

export async function deleteCategoryAction(name: string): Promise<TaxonomyActionResult> {
  const count = deleteCategory(name);
  revalidateCategories();
  return { ok: true, count };
}

// Shared by /shopping and /menu — both lists group by default storage
// location using the same preference, so flipping it on one flips both.
export async function setListGroupingAction(value: unknown): Promise<{ ok: true }> {
  const parsed = listGroupingSchema.safeParse(value);
  if (parsed.success) {
    setListGrouping(parsed.data);
    revalidatePath("/shopping");
    revalidatePath("/menu");
  }
  return { ok: true };
}

// Marks the first-run welcome dialog as seen so it never shows again.
export async function markWelcomeSeenAction(): Promise<{ ok: true }> {
  setHasSeenWelcome(true);
  revalidatePath("/");
  revalidatePath("/settings");
  return { ok: true };
}

// Form action (used with React's useActionState). Reads the named form fields,
// validates them with the shared Zod schema (§4.1), and persists.
export async function saveSettingsAction(
  _prev: SaveSettingsResult | null,
  formData: FormData,
): Promise<SaveSettingsResult> {
  const input = {
    unitSystem: formData.get("unitSystem"),
    priceMode: formData.get("priceMode"),
    averageWindowMonths: formData.get("averageWindowMonths"),
    currency: formData.get("currency"),
    roundingMode: formData.get("roundingMode"),
    recipesPerPage: formData.get("recipesPerPage"),
    ingredientsPerPage: formData.get("ingredientsPerPage"),
    showRecipeImages: formData.get("showRecipeImages"),
    showLocations: formData.get("showLocations"),
  };

  const parsed = settingsUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" };
  }

  updateSettings(parsed.data);
  revalidatePath("/settings");
  // Page size changed — drop the client Router Cache entries for the paginated lists.
  revalidatePath("/recipes");
  revalidatePath("/ingredients");
  // The recipe detail page's photo banner is gated on showRecipeImages.
  revalidatePath("/recipes/[id]", "page");
  // showLocations hides location fields/grouping across these routes.
  revalidatePath("/ingredients/[id]", "page");
  revalidatePath("/ingredients/new");
  revalidatePath("/ingredients/inventory/add");
  revalidatePath("/ingredients/inventory/edit");
  revalidatePath("/ingredients/inventory/remove");
  revalidatePath("/shopping");
  revalidatePath("/menu");
  return { ok: true, savedAt: Date.now() };
}

// Separate from saveSettingsAction so saving general settings never touches the
// API key, and vice versa.
export async function saveApiKeyAction(
  _prev: SaveApiKeyResult | null,
  formData: FormData,
): Promise<SaveApiKeyResult> {
  const parsed = anthropicKeySchema.safeParse({ anthropicApiKey: formData.get("anthropicApiKey") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid API key" };
  }

  setAnthropicApiKey(parsed.data.anthropicApiKey);
  revalidatePath("/settings");
  revalidatePath("/recipes/import");
  return { ok: true, hasKey: resolveAnthropicApiKey() != null };
}

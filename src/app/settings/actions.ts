"use server";

import { revalidatePath } from "next/cache";
import { settingsUpdateSchema, anthropicKeySchema } from "@/lib/validation/settings";
import { locationNameSchema } from "@/lib/validation/location";
import { updateSettings, setAnthropicApiKey, resolveAnthropicApiKey } from "@/lib/db/settings";
import { createLocation, renameLocation, deleteLocation } from "@/lib/db/locations";

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
  };

  const parsed = settingsUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings" };
  }

  updateSettings(parsed.data);
  revalidatePath("/settings");
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

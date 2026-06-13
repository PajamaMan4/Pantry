"use server";

import { revalidatePath } from "next/cache";
import { settingsUpdateSchema } from "@/lib/validation/settings";
import { updateSettings } from "@/lib/db/settings";

export type SaveSettingsResult =
  | { ok: true; savedAt: number }
  | { ok: false; error: string };

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

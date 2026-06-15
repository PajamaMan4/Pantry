import { z } from "zod";

// One Zod schema shared by the Settings form + server action (§4.1). Validation
// lives here so the API boundary and the form agree on what a valid Settings is.
export const settingsUpdateSchema = z.object({
  unitSystem: z.enum(["metric", "imperial"]),
  priceMode: z.enum(["current", "average"]),
  averageWindowMonths: z.coerce.number().int().min(1).max(24),
  currency: z
    .string()
    .trim()
    .min(1, "Currency is required")
    .max(8)
    .transform((s) => s.toUpperCase()),
  roundingMode: z.enum(["cooking", "exact"]),
});

export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;

export const inventoryViewSchema = z.enum(["alphabetical", "location"]);
export type InventoryViewValue = z.infer<typeof inventoryViewSchema>;

// API key for Claude-assisted recipe import. Blank clears the stored key.
export const anthropicKeySchema = z.object({
  anthropicApiKey: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z
      .string()
      .trim()
      .max(200)
      .nullable(),
  ),
});
export type AnthropicKeyInput = z.infer<typeof anthropicKeySchema>;

import { z } from "zod";
import { PAGE_SIZE_OPTIONS } from "@/lib/domain/pagination";

// Base UI's Switch always submits a value — `value` when on, `uncheckedValue`
// when off — so the FormData key is never missing the way a native unchecked
// checkbox would be. A strict union (not a truthy coercion) means a genuinely
// *missing* key surfaces as a validation error instead of silently persisting
// `false`.
const formBoolean = z.union([
  z.boolean(),
  z.literal("1").transform(() => true),
  z.literal("0").transform(() => false),
  z.literal("on").transform(() => true),
]);

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
  // Coerced because FormData hands us strings, like averageWindowMonths above.
  recipesPerPage: z.coerce
    .number()
    .int()
    .refine((n) => (PAGE_SIZE_OPTIONS as readonly number[]).includes(n), {
      message: "Invalid page size",
    }),
  ingredientsPerPage: z.coerce
    .number()
    .int()
    .refine((n) => (PAGE_SIZE_OPTIONS as readonly number[]).includes(n), {
      message: "Invalid page size",
    }),
  showRecipeImages: formBoolean,
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

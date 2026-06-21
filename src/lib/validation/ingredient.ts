import { z } from "zod";
import { UNIT_IDS } from "@/lib/domain/units";
import { nullableText, nullableNumber } from "./common";

const unitEnum = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.enum(UNIT_IDS as [string, ...string[]]).nullable(),
);

// Master ingredient creation (typeahead "Create '<name>'" and Settings later).
export const ingredientInputSchema = z.object({
  name: z.string().trim().min(1, "Ingredient name is required").max(200),
  category: nullableText,
  defaultUnit: unitEnum,
  density: nullableNumber,
  gramsPerEach: nullableNumber,
  isStaple: z.boolean().default(false),
});

export type IngredientInput = z.infer<typeof ingredientInputSchema>;

// Editing an existing ingredient (ingredient detail page): name required, the
// rest optional. Density drives volume<->weight conversion (§3.3).
export const ingredientEditSchema = z.object({
  name: z.string().trim().min(1, "Ingredient name is required").max(200),
  category: nullableText,
  defaultUnit: unitEnum,
  density: nullableNumber,
  gramsPerEach: nullableNumber,
  isStaple: z.boolean().default(false),
});

export type IngredientEditValues = z.infer<typeof ingredientEditSchema>;

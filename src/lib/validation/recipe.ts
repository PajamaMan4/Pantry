import { z } from "zod";
import { UNIT_IDS } from "@/lib/domain/units";
import { nullableText, nullableNumber, nullableInt } from "./common";

const unitEnum = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.enum(UNIT_IDS as [string, ...string[]]).nullable(),
);

const idOrNull = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.coerce.number().int().positive().nullable(),
);

const stepQuantitySchema = z.object({
  ingredientId: z.number().int().positive().nullable(),
  amount: z.number().finite(),
  amountMax: z.number().finite().nullable().optional(),
  unit: z.string().nullable(),
});

const stepSchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1, "Step text can't be empty"),
  // {qN} placeholders linked to structured quantities (§2.4.b). Optional so
  // plain-text steps still validate.
  quantities: z.record(z.string(), stepQuantitySchema).optional(),
});

const ingredientRowSchema = z
  .object({
    ingredientId: idOrNull,
    name: nullableText,
    amount: nullableNumber,
    amountMax: nullableNumber,
    unit: unitEnum,
    raw: nullableText,
    prep: nullableText,
    optional: z.boolean().default(false),
    sectionTitle: nullableText,
  })
  .refine((r) => r.ingredientId != null || (r.name != null && r.name.length > 0), {
    message: "Pick an ingredient or type a name.",
    path: ["name"],
  });

export const recipeInputSchema = z.object({
  name: z.string().trim().min(1, "Recipe name is required").max(200),
  description: nullableText,
  prepTimeMin: nullableInt,
  cookTimeMin: nullableInt,
  baseServings: z.coerce.number().positive("Servings must be greater than 0"),
  notes: nullableText,
  isFavorite: z.boolean().default(false),
  tags: z.array(z.string().trim().min(1)).default([]),
  ingredients: z.array(ingredientRowSchema).default([]),
  steps: z.array(stepSchema).default([]),
  // Variant group name (blank => standalone). Resolved to a group on write.
  groupName: nullableText,
});

export type RecipeInput = z.infer<typeof recipeInputSchema>;

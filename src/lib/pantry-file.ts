import { z } from "zod";
import { ingredientGroupsSchema, type IngredientGroups } from "@/lib/domain/sections";

export const PANTRY_FILE_VERSION = 1;

// Step quantities omit ingredientId — IDs are instance-specific and don't
// transfer between databases. Scaling by ratio still works without it; only
// density-based cross-category conversion (g↔cup) is lost.
const fileStepQuantitySchema = z.object({
  amount: z.number(),
  amountMax: z.number().nullable().optional(),
  unit: z.string().nullable(),
});

const fileStepSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  quantities: z.record(fileStepQuantitySchema).optional(),
});

const fileIngredientSchema = z.object({
  name: z.string().min(1),
  amount: z.number().nullable(),
  amountMax: z.number().nullable(),
  unit: z.string().nullable(),
  raw: z.string().nullable(),
  prep: z.string().nullable(),
  optional: z.boolean(),
});

export type FileIngredient = z.infer<typeof fileIngredientSchema>;

// `ingredients` is either a flat array or an array of labeled sections (§2.4).
const fileIngredientsSchema = ingredientGroupsSchema(fileIngredientSchema);
export type FileIngredients = IngredientGroups<FileIngredient>;

export const pantryFileSchema = z.object({
  pantryVersion: z.literal(1),
  name: z.string().min(1),
  description: z.string().nullable(),
  prepTimeMin: z.number().int().nonnegative().nullable(),
  cookTimeMin: z.number().int().nonnegative().nullable(),
  baseServings: z.number().positive(),
  notes: z.string().nullable(),
  isFavorite: z.boolean(),
  tags: z.array(z.string()),
  ingredients: fileIngredientsSchema,
  steps: z.array(fileStepSchema),
});

export type PantryFile = z.infer<typeof pantryFileSchema>;

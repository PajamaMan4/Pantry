"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { nanoid } from "nanoid";
import { resolveAnthropicApiKey } from "@/lib/db/settings";
import { extractRecipe } from "@/lib/import/extract-recipe";
import { createRecipe, type RecipeIngredientInput, type RecipeWriteInput } from "@/lib/db/recipes";
import type { Step } from "@/lib/db/schema";
import { pantryFileSchema } from "@/lib/pantry-file";
import { toSections } from "@/lib/domain/sections";

export type ImportResult = { ok: false; error: string; needsKey?: boolean };

// Maps common unit words the model emits onto our canonical unit ids. Anything
// not recognized stays as null (and is preserved in the row's `raw` text so the
// original wording isn't lost when the user reviews the draft).
const UNIT_ALIASES: Record<string, string> = {
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  tbsp: "tbsp", tbs: "tbsp", tbl: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
  "fl oz": "fl_oz", floz: "fl_oz", fl_oz: "fl_oz", "fluid ounce": "fl_oz", "fluid ounces": "fl_oz",
  cup: "cup", cups: "cup", c: "cup",
  ml: "ml", milliliter: "ml", millilitre: "ml", milliliters: "ml", millilitres: "ml",
  l: "l", liter: "l", litre: "l", liters: "l", litres: "l",
  oz: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  g: "g", gram: "g", grams: "g", gramme: "g", grammes: "g",
  kg: "kg", kilogram: "kg", kilograms: "kg", kilo: "kg", kilos: "kg",
  each: "each", whole: "each",
  pinch: "pinch", pinches: "pinch",
};

function normalizeUnit(unit: string | null): string | null {
  if (!unit) return null;
  return UNIT_ALIASES[unit.trim().toLowerCase()] ?? null;
}

export async function importRecipeAction(rawText: string): Promise<ImportResult> {
  const apiKey = resolveAnthropicApiKey();
  if (!apiKey) {
    return {
      ok: false,
      needsKey: true,
      error: "No Anthropic API key configured. Add one in Settings, or enter the recipe manually.",
    };
  }

  const result = await extractRecipe(rawText, apiKey);
  if (!result.ok) return { ok: false, error: result.error };

  const r = result.recipe;
  const ingredients: RecipeIngredientInput[] = r.ingredients.map((ing) => {
    const unit = normalizeUnit(ing.unit);
    const unrecognized = ing.unit != null && unit == null;
    return {
      ingredientId: null,
      name: ing.name,
      amount: ing.amount,
      amountMax: ing.amountMax,
      unit,
      // Preserve the original wording when we couldn't map the unit.
      raw: unrecognized
        ? [ing.amount ?? "", ing.unit, ing.name].filter(Boolean).join(" ").trim()
        : null,
      prep: ing.prep,
      optional: ing.optional,
    };
  });

  const steps: Step[] = r.steps.map((text) => ({ id: nanoid(), text }));

  const draft: RecipeWriteInput = {
    name: r.name,
    description: r.description,
    prepTimeMin: r.prepMinutes,
    cookTimeMin: r.cookMinutes,
    baseServings: r.servings && r.servings > 0 ? r.servings : 1,
    notes: null,
    isFavorite: false,
    tags: [],
    ingredients,
    steps,
  };

  const id = createRecipe(draft);
  revalidatePath("/recipes");
  // Drop the user into the editor to review the imported draft before it's final.
  redirect(`/recipes/${id}/edit`);
}

export async function importPantryFileAction(json: unknown): Promise<ImportResult> {
  const parsed = pantryFileSchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "unknown error";
    return { ok: false, error: `Invalid .pantry file: ${msg}` };
  }

  const f = parsed.data;

  // Flatten flat-or-sectioned ingredients into rows, tagging each with its
  // section title (null for a flat list) so the grouping round-trips.
  const ingredients: RecipeIngredientInput[] = toSections(f.ingredients).flatMap((section) =>
    section.ingredients.map((ing) => ({
      ingredientId: null,
      name: ing.name,
      amount: ing.amount,
      amountMax: ing.amountMax,
      unit: ing.unit,
      raw: ing.raw,
      prep: ing.prep,
      optional: ing.optional,
      sectionTitle: section.title,
    })),
  );

  const steps: Step[] = f.steps.map((s) => ({
    id: s.id,
    text: s.text,
    ...(s.quantities
      ? {
          quantities: Object.fromEntries(
            Object.entries(s.quantities).map(([k, q]) => [
              k,
              { ingredientId: null, amount: q.amount, amountMax: q.amountMax ?? null, unit: q.unit },
            ]),
          ),
        }
      : {}),
  }));

  const draft: RecipeWriteInput = {
    name: f.name,
    description: f.description,
    prepTimeMin: f.prepTimeMin,
    cookTimeMin: f.cookTimeMin,
    baseServings: f.baseServings,
    notes: f.notes,
    isFavorite: f.isFavorite,
    tags: f.tags,
    ingredients,
    steps,
  };

  const id = createRecipe(draft);
  revalidatePath("/recipes");
  redirect(`/recipes/${id}/edit`);
}

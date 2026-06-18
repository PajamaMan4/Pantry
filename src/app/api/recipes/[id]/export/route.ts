import { NextResponse } from "next/server";
import { getRecipeDetail } from "@/lib/db/recipes";
import { PANTRY_FILE_VERSION, type PantryFile } from "@/lib/pantry-file";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipeId = Number(id);
  if (!Number.isInteger(recipeId) || recipeId <= 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const detail = getRecipeDetail(recipeId);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { recipe, ingredients, tags } = detail;

  const file: PantryFile = {
    pantryVersion: PANTRY_FILE_VERSION,
    name: recipe.name,
    description: recipe.description ?? null,
    prepTimeMin: recipe.prepTimeMin ?? null,
    cookTimeMin: recipe.cookTimeMin ?? null,
    baseServings: recipe.baseServings,
    notes: recipe.notes ?? null,
    isFavorite: recipe.isFavorite,
    tags: tags.map((t) => t.name),
    ingredients: ingredients.map((ri) => ({
      name: ri.ingredient.name,
      amount: ri.amount ?? null,
      amountMax: ri.amountMax ?? null,
      unit: ri.unit ?? null,
      raw: ri.raw ?? null,
      prep: ri.prep ?? null,
      optional: ri.optional,
    })),
    steps: recipe.steps.map((s) => {
      const quantities = s.quantities
        ? Object.fromEntries(
            Object.entries(s.quantities).map(([k, q]) => [
              k,
              { amount: q.amount, amountMax: q.amountMax ?? null, unit: q.unit },
            ]),
          )
        : undefined;
      return { id: s.id, text: s.text, ...(quantities ? { quantities } : {}) };
    }),
  };

  const slug = recipe.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const filename = `${slug || "recipe"}.pantry`;

  return new NextResponse(JSON.stringify(file, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

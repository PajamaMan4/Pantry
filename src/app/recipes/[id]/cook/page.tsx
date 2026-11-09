import type { Metadata } from "next";
import { notFoundWithReason, notFoundInvalidId } from "@/lib/not-found";
import { getRecipeDetail } from "@/lib/db/recipes";
import { getSettings } from "@/lib/db/settings";
import { toDisplaySystem } from "@/lib/domain/scaling";
import { CookMode } from "./cook-mode";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cooking · Pantry" };

export default async function CookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipeId = Number(id);
  if (!Number.isInteger(recipeId)) notFoundInvalidId("recipe", id);

  const detail = getRecipeDetail(recipeId);
  if (!detail) notFoundWithReason("recipe", recipeId);

  const { recipe, ingredients } = detail;
  const settings = getSettings();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <CookMode
        recipeId={recipe.id}
        recipeName={recipe.name}
        baseServings={recipe.baseServings}
        defaultSystem={toDisplaySystem(settings.unitSystem)}
        rounding={settings.roundingMode === "exact" ? "exact" : "cooking"}
        ingredients={ingredients.map((ri) => ({
          id: ri.id,
          ingredientId: ri.ingredientId,
          name: ri.ingredient.name,
          amount: ri.amount,
          amountMax: ri.amountMax,
          unit: ri.unit,
          raw: ri.raw,
          prep: ri.prep,
          optional: ri.optional,
          isStaple: ri.ingredient.isStaple,
          density: ri.ingredient.density,
          sectionTitle: ri.sectionTitle,
        }))}
        steps={recipe.steps}
      />
    </div>
  );
}

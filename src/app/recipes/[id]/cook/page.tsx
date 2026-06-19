import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRecipeDetail } from "@/lib/db/recipes";
import { getSettings } from "@/lib/db/settings";
import { CookMode } from "./cook-mode";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Cooking · Pantry" };

export default async function CookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipeId = Number(id);
  if (!Number.isInteger(recipeId)) notFound();

  const detail = getRecipeDetail(recipeId);
  if (!detail) notFound();

  const { recipe, ingredients } = detail;
  const settings = getSettings();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <CookMode
        recipeId={recipe.id}
        recipeName={recipe.name}
        baseServings={recipe.baseServings}
        defaultSystem={settings.unitSystem === "metric" ? "metric" : "imperial"}
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

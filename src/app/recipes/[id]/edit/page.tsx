import { notFound } from "next/navigation";
import { listIngredients } from "@/lib/db/ingredients";
import { listTags } from "@/lib/db/tags";
import { getRecipeDetail } from "@/lib/db/recipes";
import { RecipeForm, type RecipeFormInitial } from "../../recipe-form";

export const dynamic = "force-dynamic";

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipeId = Number(id);
  if (!Number.isInteger(recipeId)) notFound();

  const detail = getRecipeDetail(recipeId);
  if (!detail) notFound();

  const { recipe } = detail;
  const initial: RecipeFormInitial = {
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    prepTimeMin: recipe.prepTimeMin,
    cookTimeMin: recipe.cookTimeMin,
    baseServings: recipe.baseServings,
    notes: recipe.notes,
    isFavorite: recipe.isFavorite,
    tags: detail.tags.map((t) => t.name),
    ingredients: detail.ingredients.map((ri) => ({
      ingredientId: ri.ingredientId,
      ingredientName: ri.ingredient.name,
      amount: ri.amount,
      amountMax: ri.amountMax,
      unit: ri.unit,
      raw: ri.raw,
      prep: ri.prep,
      optional: ri.optional,
      sectionTitle: ri.sectionTitle,
    })),
    steps: recipe.steps.map((s) => ({
      id: s.id,
      text: s.text,
      quantities: Object.fromEntries(
        Object.entries(s.quantities ?? {}).map(([k, q]) => [
          k,
          { ingredientId: q.ingredientId, amount: q.amount, amountMax: q.amountMax ?? null, unit: q.unit },
        ]),
      ),
    })),
  };

  const ingredients = listIngredients();
  const tags = listTags();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Edit recipe</h1>
      <RecipeForm
        initial={initial}
        ingredientOptions={ingredients.map((i) => ({
          id: i.id,
          name: i.name,
          defaultUnit: i.defaultUnit,
        }))}
        tagSuggestions={tags.map((t) => t.name)}
      />
    </div>
  );
}

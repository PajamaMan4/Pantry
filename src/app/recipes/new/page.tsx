import type { Metadata } from "next";
import { listIngredientsWithAliases } from "@/lib/db/ingredients";
import { listTags } from "@/lib/db/tags";
import { listRecipeGroups } from "@/lib/db/recipe-groups";
import { RecipeForm } from "../recipe-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New recipe · Pantry" };

export default function NewRecipePage() {
  const ingredients = listIngredientsWithAliases();
  const tags = listTags();
  const groups = listRecipeGroups();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">New recipe</h1>
      <RecipeForm
        ingredientOptions={ingredients.map((i) => ({
          id: i.id,
          name: i.name,
          defaultUnit: i.defaultUnit,
          aliases: i.aliases,
        }))}
        tagSuggestions={tags.map((t) => t.name)}
        groupSuggestions={groups.map((g) => g.name)}
      />
    </div>
  );
}

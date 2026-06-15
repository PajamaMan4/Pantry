import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { RecipeCard } from "@/components/recipe-card";
import { RecipeFilters } from "./recipe-filters";
import { listRecipes, type RecipeListFilters } from "@/lib/db/recipes";
import { listTags } from "@/lib/db/tags";
import { listIngredients } from "@/lib/db/ingredients";
import { getSettings } from "@/lib/db/settings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Recipes · Pantry" };

function toInt(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const str = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;

  const filters: RecipeListFilters = {
    search: str("q"),
    tagId: toInt(str("tag")),
    ingredientId: toInt(str("ingredient")),
    maxTotalTimeMin: toInt(str("maxTime")),
    favoritesOnly: str("fav") === "1",
  };

  const recipes = listRecipes(filters);
  const tags = listTags();
  const ingredients = listIngredients();
  const settings = getSettings();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>
        <Link href="/recipes/new" className={buttonVariants()}>
          <PlusIcon className="size-4" /> New recipe
        </Link>
      </div>

      <div className="mb-6">
        <RecipeFilters
          tags={tags.map((t) => ({ id: t.id, name: t.name }))}
          ingredients={ingredients.map((i) => ({ id: i.id, name: i.name }))}
        />
      </div>

      {recipes.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No recipes match. Try clearing filters, or{" "}
          <Link href="/recipes/new" className="text-primary underline-offset-4 hover:underline">
            create one
          </Link>
          .
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {recipes.map((item) => (
            <RecipeCard key={item.recipe.id} item={item} currency={settings.currency} />
          ))}
        </div>
      )}
    </div>
  );
}

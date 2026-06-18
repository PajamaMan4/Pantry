import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, SparklesIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { RecipeCard } from "@/components/recipe-card";
import { RecipeFilters } from "./recipe-filters";
import { listRecipes, type RecipeListFilters } from "@/lib/db/recipes";
import { listTags } from "@/lib/db/tags";
import { listIngredients } from "@/lib/db/ingredients";
import { getSettings } from "@/lib/db/settings";
import { getRecommendations } from "@/lib/db/recommend";
import type { RecommendSort, RecommendResult } from "@/lib/domain/recommend";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Recipes · Pantry" };

const SORTS = [
  { value: "alpha", label: "Alphabetical" },
  { value: "available", label: "Most Available" },
  { value: "expiring", label: "Use Soon" },
  { value: "cost", label: "Cheapest" },
] as const;

type SortValue = (typeof SORTS)[number]["value"];

function resolveSort(v: string | undefined): SortValue {
  if (v === "available" || v === "expiring" || v === "cost") return v;
  return "alpha";
}

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

  const sort = resolveSort(str("sort"));

  const rawTags = sp["tag"];
  const tagIds = (Array.isArray(rawTags) ? rawTags : rawTags ? [rawTags] : [])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);

  const filters: RecipeListFilters = {
    search: str("q"),
    tagIds,
    ingredientId: toInt(str("ingredient")),
    maxTotalTimeMin: toInt(str("maxTime")),
    favoritesOnly: str("fav") === "1",
  };

  const recipes = listRecipes(filters);
  const tags = listTags();
  const ingredients = listIngredients();
  const settings = getSettings();

  // Always fetch recommendation data for badges and missing-ingredient info
  const rec = getRecommendations(sort === "alpha" ? "available" : (sort as RecommendSort));
  const recByRecipeId = new Map(rec.results.map((r) => [r.recipe.id, r]));
  const { ingredientNames } = rec;

  if (sort !== "alpha") {
    // Re-sort filtered recipes by recommendation order
    const posById = new Map(rec.results.map((r, i) => [r.recipe.id, i]));
    recipes.sort((a, b) => (posById.get(a.recipe.id) ?? Infinity) - (posById.get(b.recipe.id) ?? Infinity));
  }

  function buildSortUrl(s: string) {
    const next = new URLSearchParams();
    if (s !== "alpha") next.set("sort", s);
    if (filters.search) next.set("q", filters.search);
    for (const id of tagIds) next.append("tag", String(id));
    if (filters.ingredientId != null) next.set("ingredient", String(filters.ingredientId));
    if (filters.maxTotalTimeMin != null) next.set("maxTime", String(filters.maxTotalTimeMin));
    if (filters.favoritesOnly) next.set("fav", "1");
    const qs = next.toString();
    return qs ? `/recipes?${qs}` : "/recipes";
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>
        <div className="flex items-center gap-2">
          <Link href="/recipes/import" className={buttonVariants({ variant: "outline" })}>
            <SparklesIcon className="size-4" /> Import
          </Link>
          <Link href="/recipes/new" className={buttonVariants()}>
            <PlusIcon className="size-4" /> New recipe
          </Link>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-1 rounded-md border p-0.5 text-xs w-fit">
        {SORTS.map((s) => (
          <Link
            key={s.value}
            href={buildSortUrl(s.value)}
            className={cn(
              "rounded-sm px-2.5 py-1 font-medium transition-colors",
              sort === s.value
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </Link>
        ))}
      </div>

      <div className="mb-6">
        <RecipeFilters
          tags={tags.map((t) => ({ id: t.id, name: t.name }))}
          ingredients={ingredients.map((i) => ({ id: i.id, name: i.name }))}
          sort={sort}
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
            <RecipeCard
              key={item.recipe.id}
              item={item}
              currency={settings.currency}
              recommend={recByRecipeId.get(item.recipe.id)}
              ingredientNames={ingredientNames}
            />
          ))}
        </div>
      )}
    </div>
  );
}

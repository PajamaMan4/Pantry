import type { Metadata } from "next";
import Link from "next/link";
import { NotebookPenIcon, HeartIcon } from "lucide-react";
import { RecipeCard } from "@/components/recipe-card";
import { RecipeGroupCard } from "@/components/recipe-group-card";
import { RecipeFilters } from "./recipe-filters";
import { RecipesMenu } from "./recipes-menu";
import { collapseIntoGroups } from "@/lib/domain/variants";
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
  { value: "cost", label: "Cheapest" },
] as const;

type SortValue = (typeof SORTS)[number]["value"];

function resolveSort(v: string | undefined): SortValue {
  if (v === "available" || v === "cost") return v;
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
  const menuOnly = str("menu") === "1";

  const rawTags = sp["tag"];
  const tagIds = (Array.isArray(rawTags) ? rawTags : rawTags ? [rawTags] : [])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);

  const rawIngredients = sp["ingredient"];
  const ingredientIds = (Array.isArray(rawIngredients) ? rawIngredients : rawIngredients ? [rawIngredients] : [])
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0);

  const filters: RecipeListFilters = {
    search: str("q"),
    tagIds,
    ingredientIds,
    maxTotalTimeMin: toInt(str("maxTime")),
    favoritesOnly: str("fav") === "1",
    menuOnly,
  };

  const recipes = listRecipes(filters);
  const hasFilters =
    Boolean(filters.search) ||
    tagIds.length > 0 ||
    ingredientIds.length > 0 ||
    filters.maxTotalTimeMin != null ||
    filters.favoritesOnly ||
    menuOnly;
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

  function buildParams(overrides: { sort?: string; menu?: boolean; fav?: boolean }) {
    const nextSort = overrides.sort ?? sort;
    const nextMenu = overrides.menu ?? menuOnly;
    const nextFav = overrides.fav ?? filters.favoritesOnly;
    const next = new URLSearchParams();
    if (nextSort !== "alpha") next.set("sort", nextSort);
    if (nextMenu) next.set("menu", "1");
    if (filters.search) next.set("q", filters.search);
    for (const id of tagIds) next.append("tag", String(id));
    for (const id of ingredientIds) next.append("ingredient", String(id));
    if (filters.maxTotalTimeMin != null) next.set("maxTime", String(filters.maxTotalTimeMin));
    if (nextFav) next.set("fav", "1");
    const qs = next.toString();
    return qs ? `/recipes?${qs}` : "/recipes";
  }

  const buildSortUrl = (s: string) => buildParams({ sort: s });
  const buildMenuUrl = () => buildParams({ menu: !menuOnly });
  const buildFavUrl = () => buildParams({ fav: !filters.favoritesOnly });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Recipes</h1>
        <RecipesMenu />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center gap-1 rounded-md border p-0.5 w-fit">
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
        <div className="rounded-md border p-0.5 w-fit">
          <Link
            href={buildMenuUrl()}
            aria-pressed={menuOnly}
            className={cn(
              "inline-flex items-center gap-1 rounded-sm px-2.5 py-1 font-medium transition-colors",
              menuOnly
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <NotebookPenIcon className="size-3.5" /> Menu
          </Link>
        </div>
        <div className="rounded-md border p-0.5 w-fit">
          <Link
            href={buildFavUrl()}
            aria-pressed={filters.favoritesOnly}
            className={cn(
              "inline-flex items-center gap-1 rounded-sm px-2.5 py-1 font-medium transition-colors",
              filters.favoritesOnly
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <HeartIcon
              className={cn("size-3.5", filters.favoritesOnly && "fill-red-500 text-red-500")}
            />{" "}
            Favorites
          </Link>
        </div>
      </div>

      <div className="mb-6">
        <RecipeFilters
          tags={tags.map((t) => ({ id: t.id, name: t.name }))}
          ingredients={ingredients.map((i) => ({ id: i.id, name: i.name }))}
          sort={sort}
        />
      </div>

      {recipes.length === 0 ? (
        hasFilters ? (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No recipes match. Try clearing filters, or{" "}
            <Link href="/recipes/new" className="text-primary underline-offset-4 hover:underline">
              create one
            </Link>
            .
          </p>
        ) : (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No recipes yet.{" "}
            <Link href="/recipes/new" className="text-primary underline-offset-4 hover:underline">
              Create one
            </Link>{" "}
            or{" "}
            <Link href="/recipes/import" className="text-primary underline-offset-4 hover:underline">
              import from text or a file
            </Link>
            .
          </p>
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {collapseIntoGroups(recipes, (item) => item.group).map((row) =>
            row.kind === "single" ? (
              <RecipeCard
                key={`r-${row.item.recipe.id}`}
                item={row.item}
                currency={settings.currency}
                recommend={recByRecipeId.get(row.item.recipe.id)}
                ingredientNames={ingredientNames}
              />
            ) : (
              <RecipeGroupCard key={`g-${row.group.id}`} name={row.group.name} count={row.members.length}>
                {row.members.map((m) => (
                  <RecipeCard
                    key={m.recipe.id}
                    item={m}
                    currency={settings.currency}
                    recommend={recByRecipeId.get(m.recipe.id)}
                    ingredientNames={ingredientNames}
                  />
                ))}
              </RecipeGroupCard>
            ),
          )}
        </div>
      )}
    </div>
  );
}

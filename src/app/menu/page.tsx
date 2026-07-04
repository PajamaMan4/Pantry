import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import { RecipeCard } from "@/components/recipe-card";
import { RecipeGroupCard } from "@/components/recipe-group-card";
import { AddMissingForMenuButton } from "@/components/add-missing-for-menu-button";
import { collapseIntoGroups } from "@/lib/domain/variants";
import { listRecipes } from "@/lib/db/recipes";
import { getSettings } from "@/lib/db/settings";
import { getRecommendations } from "@/lib/db/recommend";
import { getMenuIngredientSummary } from "@/lib/db/menu";
import { formatQuantityText } from "@/lib/domain/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Menu · Pantry" };

export default async function MenuPage() {
  const recipes = listRecipes({ menuOnly: true });
  const settings = getSettings();
  const { results, ingredientNames } = getRecommendations("available");
  const recByRecipeId = new Map(results.map((r) => [r.recipe.id, r]));
  const { lines } = getMenuIngredientSummary();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6">
        <Link href="/recipes" className="text-sm text-muted-foreground hover:text-foreground">
          ← All recipes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Menu</h1>
        <p className="mt-1 text-sm text-muted-foreground">Recipes you plan to make soon.</p>
      </div>

      {recipes.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No recipes on the menu yet. Add some from the{" "}
          <Link href="/recipes" className="text-primary underline-offset-4 hover:underline">
            Recipes page
          </Link>
          .
        </p>
      ) : (
        <>
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

          <section className="mt-10">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-medium">Ingredients needed</h2>
              <AddMissingForMenuButton />
            </div>
            {lines.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                These recipes have no ingredients listed.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border px-3">
                {lines.map((line) => (
                  <li key={line.ingredientId} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="inline-flex items-center gap-2">
                      {line.inStock ? (
                        <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="In stock" />
                      ) : (
                        <XCircleIcon className="size-4 shrink-0 text-red-600 dark:text-red-400" aria-label="Not enough in stock" />
                      )}
                      <span>{line.name}</span>
                    </span>
                    {line.amount != null && (
                      <span className="text-muted-foreground">
                        {formatQuantityText({ amount: line.amount, unit: line.unit })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

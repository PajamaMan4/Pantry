import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import { MenuRecipeRow } from "./menu-recipe-row";
import { AddMissingForMenuButton } from "@/components/add-missing-for-menu-button";
import { ListGroupingToggle } from "@/components/list-grouping-toggle";
import { PageHelpMenu } from "@/components/help/page-help-menu";
import { Badge } from "@/components/ui/badge";
import { listRecipes } from "@/lib/db/recipes";
import { getMenuIngredientSummary } from "@/lib/db/menu";
import { getSettings } from "@/lib/db/settings";
import { formatQuantityText } from "@/lib/domain/format";
import { groupByLocation } from "@/lib/domain/location-groups";
import { groupByCategory } from "@/lib/domain/category-groups";
import type { MenuIngredientLine } from "@/lib/domain/menu";

type MenuGroup = { name: string; items: MenuIngredientLine[] };

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Menu · Pantry" };

function MenuIngredientLineItem({ line }: { line: MenuIngredientLine }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <span className="inline-flex items-center gap-2">
        {line.inStock ? (
          <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="In stock" />
        ) : (
          <XCircleIcon className="size-4 shrink-0 text-red-600 dark:text-red-400" aria-label="Not enough in stock" />
        )}
        <Link href={`/ingredients/${line.ingredientId}`} className="capitalize hover:underline">
          {line.name}
        </Link>
      </span>
      {line.amount != null && (
        <span className="text-muted-foreground">{formatQuantityText({ amount: line.amount, unit: line.unit })}</span>
      )}
    </li>
  );
}

export default async function MenuPage() {
  const recipes = listRecipes({ menuOnly: true });
  const { lines } = getMenuIngredientSummary();
  const { listGrouping, showLocations } = getSettings();
  const grouping = listGrouping === "none" ? "none" : "grouped";
  const groups: MenuGroup[] | null =
    grouping === "grouped"
      ? showLocations
        ? groupByLocation(lines, (l) => l.location)
        : groupByCategory(lines, (l) => l.category)
      : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <Link href="/recipes" className="text-sm text-muted-foreground hover:text-foreground">
            ← All recipes
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Menu</h1>
          <p className="mt-1 text-sm text-muted-foreground">Recipes you plan to make soon.</p>
        </div>
        <PageHelpMenu topicId="menu" />
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
          <ul className="divide-y rounded-lg border px-3">
            {recipes.map(({ recipe }) => (
              <MenuRecipeRow
                key={recipe.id}
                id={recipe.id}
                name={recipe.name}
                baseServings={recipe.baseServings}
                menuServings={recipe.menuServings}
              />
            ))}
          </ul>

          <section className="mt-10">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-medium">Ingredients needed</h2>
              <div className="flex items-center gap-2">
                <ListGroupingToggle current={grouping} showLocations={showLocations} />
                <AddMissingForMenuButton />
              </div>
            </div>
            {lines.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                These recipes have no ingredients listed.
              </p>
            ) : groups ? (
              <div className="space-y-6">
                {groups.map((g) => (
                  <section key={g.name}>
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <span>{g.name}</span>
                      <Badge variant="secondary">{g.items.length}</Badge>
                    </h3>
                    <ul className="divide-y rounded-lg border px-3">
                      {g.items.map((line) => (
                        <MenuIngredientLineItem key={line.ingredientId} line={line} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <ul className="divide-y rounded-lg border px-3">
                {lines.map((line) => (
                  <MenuIngredientLineItem key={line.ingredientId} line={line} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

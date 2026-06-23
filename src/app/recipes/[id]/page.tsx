import Link from "next/link";
import { notFound } from "next/navigation";
import { ClockIcon, ChefHatIcon, LayersIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FavoriteButton } from "../favorite-button";
import { RecipeActionsMenu } from "../recipe-actions-menu";
import { RecipeScaler } from "../recipe-scaler";
import { UndoCookButton } from "../undo-cook-button";
import { RecipeCostSummary } from "../recipe-cost-summary";
import { RatingStars } from "@/components/rating-stars";
import { getRecipeDetail, getVariantsInGroup } from "@/lib/db/recipes";
import { listIngredientsWithAliases } from "@/lib/db/ingredients";
import { getSettings } from "@/lib/db/settings";
import { getCookData, cookStats, listCookLogsForRecipe } from "@/lib/db/cook";
import { recipeCostFor } from "@/lib/db/recipe-cost";
import { formatMinutes, totalTimeMin, formatNumber, formatMoney } from "@/lib/domain/format";

export const dynamic = "force-dynamic";

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipeId = Number(id);
  if (!Number.isInteger(recipeId)) notFound();

  const detail = getRecipeDetail(recipeId);
  if (!detail) notFound();

  const { recipe, ingredients, tags, group } = detail;
  const variants = group ? getVariantsInGroup(group.id, recipe.id) : [];
  const settings = getSettings();
  const total = totalTimeMin(recipe.prepTimeMin, recipe.cookTimeMin);
  const cookData = getCookData(recipeId)!;
  const stats = cookStats(recipeId);
  const history = listCookLogsForRecipe(recipeId, 5);
  const cost = recipeCostFor(recipeId);
  const ingredientNames: Record<number, string> = Object.fromEntries(
    ingredients.map((ri) => [ri.ingredientId, ri.ingredient.name]),
  );
  const ingredientOptions = listIngredientsWithAliases().map((i) => ({
    id: i.id,
    name: i.name,
    defaultUnit: i.defaultUnit,
    aliases: i.aliases,
  }));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link href="/recipes" className="text-sm text-muted-foreground hover:text-foreground">
        ← All recipes
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{recipe.name}</h1>
          <FavoriteButton id={recipe.id} isFavorite={recipe.isFavorite} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={`/recipes/${recipe.id}/cook`} className={buttonVariants({ size: "sm" })}>
            <ChefHatIcon className="size-4" /> Cook mode
          </Link>
          <RecipeActionsMenu recipeId={recipe.id} />
        </div>
      </div>

      <div className="mt-2">
        <RatingStars recipeId={recipe.id} rating={recipe.rating} />
      </div>

      {recipe.description && <p className="mt-2 text-muted-foreground">{recipe.description}</p>}

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <ClockIcon className="size-4" /> {formatMinutes(total)}
          {(recipe.prepTimeMin != null || recipe.cookTimeMin != null) && (
            <span className="text-xs">
              {" "}
              ({formatMinutes(recipe.prepTimeMin)} prep · {formatMinutes(recipe.cookTimeMin)} cook)
            </span>
          )}
        </span>
        {stats.timesCooked > 0 && (
          <span className="inline-flex items-center gap-1">
            <ChefHatIcon className="size-4" /> Made {stats.timesCooked}×
            {stats.lastCookedAt && <span className="text-xs"> · last {stats.lastCookedAt.toLocaleDateString()}</span>}
          </span>
        )}
      </div>

      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <Badge key={t.id} variant="secondary">
              {t.name}
            </Badge>
          ))}
        </div>
      )}

      {cost && (
        <RecipeCostSummary
          cost={cost}
          currency={settings.currency}
          baseServings={recipe.baseServings}
          names={ingredientNames}
        />
      )}

      {group && variants.length > 0 && (
        <div className="mt-4 rounded-lg border bg-muted/30 p-3">
          <div className="mb-2 inline-flex items-center gap-2 text-sm font-medium">
            <LayersIcon className="size-4" /> Variants · {group.name}
          </div>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <Link
                key={v.id}
                href={`/recipes/${v.id}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {v.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <Separator className="my-6" />

      <RecipeScaler
        recipeId={recipe.id}
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
        cookIngredients={cookData.ingredients}
        cookStock={cookData.stock}
        ingredientOptions={ingredientOptions}
      />

      {recipe.notes && (
        <>
          <Separator className="my-6" />
          <section>
            <h2 className="mb-2 text-lg font-medium">Notes</h2>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{recipe.notes}</p>
          </section>
        </>
      )}

      {history.length > 0 && (
        <>
          <Separator className="my-6" />
          <section>
            <h2 className="mb-2 text-lg font-medium">Cook history</h2>
            <ul className="divide-y rounded-lg border px-3">
              {history.map((log) => (
                <li key={log.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    <span className="text-muted-foreground">{new Date(log.cookedAt).toLocaleDateString()}</span>{" "}
                    · {formatNumber(log.servingsMade)} serving{log.servingsMade === 1 ? "" : "s"}
                    {log.totalCost != null && (
                      <span className="text-muted-foreground"> · {formatMoney(log.totalCost, settings.currency)}</span>
                    )}
                  </span>
                  <UndoCookButton cookLogId={log.id} recipeId={recipe.id} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

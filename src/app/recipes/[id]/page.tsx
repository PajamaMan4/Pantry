import Link from "next/link";
import { ClockIcon, ChefHatIcon, LayersIcon } from "lucide-react";
import { notFoundWithReason, notFoundInvalidId } from "@/lib/not-found";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FavoriteButton } from "../favorite-button";
import { MenuButton } from "../menu-button";
import { RecipeActionsMenu } from "../recipe-actions-menu";
import { RecipeScaler } from "../recipe-scaler";
import { UndoCookButton } from "../undo-cook-button";
import { RecipeCostSummary } from "../recipe-cost-summary";
import { CookModeToggle } from "../cook-mode-toggle";
import { RecipeViewProvider } from "../recipe-view-context";
import { getRecipeDetail, getVariantsInGroup } from "@/lib/db/recipes";
import { listIngredientsWithAliases } from "@/lib/db/ingredients";
import { getSettings } from "@/lib/db/settings";
import { getCookData, cookStats, listCookLogsForRecipe } from "@/lib/db/cook";
import { recipeCostFor } from "@/lib/db/recipe-cost";
import { formatMinutes, totalTimeMin, formatNumber, formatMoney } from "@/lib/domain/format";
import { recipeImageSrc } from "@/lib/domain/recipe-image";

export const dynamic = "force-dynamic";

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipeId = Number(id);
  if (!Number.isInteger(recipeId)) notFoundInvalidId("recipe", id);

  const detail = getRecipeDetail(recipeId);
  if (!detail) notFoundWithReason("recipe", recipeId);

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

  const showBanner = settings.showRecipeImages && detail.image != null;
  const bannerSrc = detail.image ? recipeImageSrc(recipe.id, detail.image.updatedAt.getTime()) : null;

  const header = (
    <>
      <div className="flex items-center justify-between gap-3">
        <Link href="/recipes" className="text-sm text-muted-foreground hover:text-foreground">
          ← All recipes
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <MenuButton id={recipe.id} isOnMenu={recipe.isOnMenu} withLabel />
          <CookModeToggle />
          <RecipeActionsMenu recipeId={recipe.id} />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{recipe.name}</h1>
        <FavoriteButton id={recipe.id} isFavorite={recipe.isFavorite} />
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
    </>
  );

  return (
    <RecipeViewProvider defaultSystem={settings.unitSystem === "metric" ? "metric" : "imperial"}>
      {showBanner ? (
        // A CSS background-image, not an absolutely-positioned <img>: the earlier
        // <img absolute inset-0 size-full> approach relies on resolving a
        // percentage height against a container whose height comes only from
        // min-height (never an explicit height) — an ambiguous corner of the CSS
        // abs-pos sizing spec that Chromium and WebKit resolve differently, which
        // broke this banner on iOS (the image rendered at its intrinsic aspect
        // ratio instead of being cropped, and shoved the panel out of view).
        // `background-size: cover` is resolved against the element's own box
        // however it ends up sized, with no cross-element percentage resolution
        // involved, so this sidesteps that whole class of bug.
        <div
          // min-h-80 (not min-h-64) at every width: on a narrow phone viewport a
          // shorter floor makes for a much more cropped (width-constrained)
          // "cover" window than on desktop, showing only a thin band through the
          // photo's vertical extent — often landing on a plain/out-of-focus
          // region rather than the actual subject. A taller floor lets more of
          // the photo's height show through on narrow screens.
          className="w-full overflow-hidden bg-cover bg-center min-h-80"
          style={{ backgroundImage: `url(${bannerSrc})` }}
        >
          <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
            <div
              className="rounded-xl border border-border/60 bg-background/85 p-4 shadow-lg
                         supports-backdrop-filter:bg-background/55
                         supports-backdrop-filter:backdrop-blur-xl
                         supports-backdrop-filter:backdrop-saturate-150"
            >
              {header}
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-5xl px-4 pt-8">{header}</div>
      )}

      {/*
        This container's `pb-8` + the header container's `pt-8` reproduce the
        original single-container `py-8`. The Separator's `my-6` top margin can't
        collapse through this container's edge — a flex item (this is a direct
        child of <main>'s flex column) always establishes its own margin-collapsing
        context — so the no-image layout stays pixel-identical to before this
        banner feature existed.
      */}
      <div className="mx-auto w-full max-w-5xl px-4 pb-8">
        <Separator className="my-6" />

        <RecipeScaler
          recipeId={recipe.id}
          baseServings={recipe.baseServings}
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

        {cost && (
          <RecipeCostSummary
            cost={cost}
            currency={settings.currency}
            baseServings={recipe.baseServings}
            names={ingredientNames}
          />
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
    </RecipeViewProvider>
  );
}

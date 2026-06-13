import Link from "next/link";
import { notFound } from "next/navigation";
import { ClockIcon, UsersIcon, PencilIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FavoriteButton } from "../favorite-button";
import { DeleteRecipe } from "../delete-recipe";
import { getRecipeDetail } from "@/lib/db/recipes";
import {
  formatMinutes,
  totalTimeMin,
  formatNumber,
  formatQuantityText,
  renderStepText,
} from "@/lib/domain/format";

export const dynamic = "force-dynamic";

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipeId = Number(id);
  if (!Number.isInteger(recipeId)) notFound();

  const detail = getRecipeDetail(recipeId);
  if (!detail) notFound();

  const { recipe, ingredients, tags } = detail;
  const total = totalTimeMin(recipe.prepTimeMin, recipe.cookTimeMin);

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
          <Link
            href={`/recipes/${recipe.id}/edit`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <PencilIcon className="size-4" /> Edit
          </Link>
          <DeleteRecipe id={recipe.id} />
        </div>
      </div>

      {recipe.description && (
        <p className="mt-2 text-muted-foreground">{recipe.description}</p>
      )}

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
        <span className="inline-flex items-center gap-1">
          <UsersIcon className="size-4" /> Serves {formatNumber(recipe.baseServings)}
        </span>
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

      <Separator className="my-6" />

      <section>
        <h2 className="mb-3 text-lg font-medium">Ingredients</h2>
        {ingredients.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ingredients listed.</p>
        ) : (
          <ul className="space-y-1.5">
            {ingredients.map((ri) => {
              const qty = formatQuantityText({
                amount: ri.amount,
                amountMax: ri.amountMax,
                unit: ri.unit,
                raw: ri.raw,
              });
              return (
                <li key={ri.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  {qty && <span className="tabular-nums text-foreground">{qty}</span>}
                  <span className="font-medium">{ri.ingredient.name}</span>
                  {ri.prep && <span className="text-muted-foreground">— {ri.prep}</span>}
                  {ri.optional && (
                    <Badge variant="outline" className="text-[10px]">
                      optional
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Separator className="my-6" />

      <section>
        <h2 className="mb-3 text-lg font-medium">Steps</h2>
        {recipe.steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No steps yet.</p>
        ) : (
          <ol className="space-y-3">
            {recipe.steps.map((step, i) => (
              <li key={step.id} className="flex gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{renderStepText(step)}</p>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Serving scaling, unit conversion, and cooking mode arrive in later phases.
        </p>
      </section>

      {recipe.notes && (
        <>
          <Separator className="my-6" />
          <section>
            <h2 className="mb-2 text-lg font-medium">Notes</h2>
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{recipe.notes}</p>
          </section>
        </>
      )}
    </div>
  );
}

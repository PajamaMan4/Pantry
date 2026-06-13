import Link from "next/link";
import { notFound } from "next/navigation";
import { ClockIcon, PencilIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FavoriteButton } from "../favorite-button";
import { DeleteRecipe } from "../delete-recipe";
import { RecipeScaler } from "../recipe-scaler";
import { getRecipeDetail } from "@/lib/db/recipes";
import { getSettings } from "@/lib/db/settings";
import { formatMinutes, totalTimeMin } from "@/lib/domain/format";

export const dynamic = "force-dynamic";

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipeId = Number(id);
  if (!Number.isInteger(recipeId)) notFound();

  const detail = getRecipeDetail(recipeId);
  if (!detail) notFound();

  const { recipe, ingredients, tags } = detail;
  const settings = getSettings();
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

      <RecipeScaler
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
          density: ri.ingredient.density,
        }))}
        steps={recipe.steps}
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
    </div>
  );
}

import Link from "next/link";
import { ClockIcon, UsersIcon, ChefHatIcon, CoinsIcon, ClockAlertIcon, CheckCircle2Icon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "@/app/recipes/favorite-button";
import { RatingDisplay } from "@/components/rating-stars";
import { AddMissingButton } from "@/components/add-missing-button";
import { formatMinutes, totalTimeMin, formatNumber, formatMoney } from "@/lib/domain/format";
import type { RecipeListItem } from "@/lib/db/recipes";
import type { RecommendResult } from "@/lib/domain/recommend";
import { cn } from "@/lib/utils";

export function RecipeCard({
  item,
  currency,
  recommend,
  ingredientNames,
}: {
  item: RecipeListItem;
  currency: string;
  recommend?: RecommendResult;
  ingredientNames?: Map<number, string>;
}) {
  const { recipe, tags, lastCookedAt, cost } = item;
  const total = totalTimeMin(recipe.prepTimeMin, recipe.cookTimeMin);
  const missingNames = recommend && ingredientNames
    ? recommend.missing.map((id) => ingredientNames.get(id) ?? "?")
    : [];

  return (
    <Card className={cn(recommend?.makeable && "border-emerald-300 dark:border-emerald-800")}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/recipes/${recipe.id}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {recipe.name}
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            {recommend?.makeable ? (
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2Icon className="size-3.5" /> makeable
              </Badge>
            ) : recommend?.almost ? (
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                almost there
              </Badge>
            ) : recommend ? (
              <Badge variant="secondary">
                {recommend.haveCount}/{recommend.requiredCount}
              </Badge>
            ) : null}
            <FavoriteButton id={recipe.id} isFavorite={recipe.isFavorite} />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ClockIcon className="size-4" /> {formatMinutes(total)}
          </span>
          <span className="inline-flex items-center gap-1">
            <UsersIcon className="size-4" /> Serves {formatNumber(recipe.baseServings)}
          </span>
          {cost.knownCount > 0 && (
            <span className="inline-flex items-center gap-1" title={cost.unknownIngredientIds.length > 0 ? "Some ingredients are unpriced" : undefined}>
              <CoinsIcon className="size-4" /> {formatMoney(cost.perServing, currency)}/serving
              {cost.unknownIngredientIds.length > 0 && <span className="text-xs">*</span>}
            </span>
          )}
          {lastCookedAt && (
            <span className="inline-flex items-center gap-1">
              <ChefHatIcon className="size-4" /> {new Date(lastCookedAt).toLocaleDateString()}
            </span>
          )}
          {recommend && recommend.expiryUrgency > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <ClockAlertIcon className="size-4" /> uses expiring stock
            </span>
          )}
          <RatingDisplay rating={recipe.rating} />
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

        {recommend && missingNames.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm">
              <span className="text-muted-foreground">Missing:</span>{" "}
              {missingNames.join(", ")}
              {recommend.unknownUnits > 0 && (
                <span className="text-muted-foreground"> ({recommend.unknownUnits} can&apos;t be checked)</span>
              )}
            </p>
            <AddMissingButton recipeId={recipe.id} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

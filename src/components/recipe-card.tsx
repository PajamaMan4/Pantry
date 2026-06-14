import Link from "next/link";
import { ClockIcon, UsersIcon, ChefHatIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FavoriteButton } from "@/app/recipes/favorite-button";
import { formatMinutes, totalTimeMin, formatNumber } from "@/lib/domain/format";
import type { RecipeListItem } from "@/lib/db/recipes";

export function RecipeCard({ item }: { item: RecipeListItem }) {
  const { recipe, tags, lastCookedAt } = item;
  const total = totalTimeMin(recipe.prepTimeMin, recipe.cookTimeMin);

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/recipes/${recipe.id}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {recipe.name}
          </Link>
          <FavoriteButton id={recipe.id} isFavorite={recipe.isFavorite} />
        </div>

        <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ClockIcon className="size-4" /> {formatMinutes(total)}
          </span>
          <span className="inline-flex items-center gap-1">
            <UsersIcon className="size-4" /> Serves {formatNumber(recipe.baseServings)}
          </span>
          {lastCookedAt && (
            <span className="inline-flex items-center gap-1">
              <ChefHatIcon className="size-4" /> {new Date(lastCookedAt).toLocaleDateString()}
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
      </CardContent>
    </Card>
  );
}

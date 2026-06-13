"use client";

import * as React from "react";
import { StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleFavoriteAction } from "./actions";

export function FavoriteButton({
  id,
  isFavorite,
  className,
}: {
  id: number;
  isFavorite: boolean;
  className?: string;
}) {
  const [fav, setFav] = React.useState(isFavorite);
  const [pending, startTransition] = React.useTransition();

  function toggle() {
    const next = !fav;
    setFav(next);
    startTransition(async () => {
      await toggleFavoriteAction(id, next);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={fav}
      aria-label={fav ? "Unfavorite" : "Favorite"}
      className={cn("text-muted-foreground transition-colors hover:text-amber-500", className)}
    >
      <StarIcon className={cn("size-5", fav && "fill-amber-400 text-amber-400")} />
    </button>
  );
}

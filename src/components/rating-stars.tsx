"use client";

import * as React from "react";
import { StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { setRatingAction } from "@/app/recipes/actions";

export function RatingStars({
  recipeId,
  rating,
  className,
}: {
  recipeId: number;
  rating: number | null;
  className?: string;
}) {
  const [value, setValue] = React.useState<number | null>(rating);
  const [hover, setHover] = React.useState<number | null>(null);
  const [pending, startTransition] = React.useTransition();

  function set(next: number) {
    // Clicking the current rating clears it.
    const v = value === next ? null : next;
    setValue(v);
    startTransition(async () => {
      await setRatingAction(recipeId, v);
    });
  }

  const shown = hover ?? value ?? 0;

  return (
    <div className={cn("flex items-center gap-0.5", className)} role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={pending}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          aria-checked={value === n}
          role="radio"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(null)}
          onClick={() => set(n)}
          className="text-muted-foreground transition-colors hover:text-amber-500 disabled:opacity-50"
        >
          <StarIcon className={cn("size-5", n <= shown && "fill-amber-400 text-amber-400")} />
        </button>
      ))}
      {value != null && <span className="ml-1 text-xs text-muted-foreground">{value}/5</span>}
    </div>
  );
}

/** Read-only compact display (server-renderable). */
export function RatingDisplay({ rating }: { rating: number | null }) {
  if (rating == null) return null;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Rated ${rating} of 5`}>
      <StarIcon className="size-4 fill-amber-400 text-amber-400" />
      <span className="tabular-nums">{rating}</span>
    </span>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, MinusIcon, PlusIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { scaleFactor, displayQuantity, renderStep, type DisplaySystem } from "@/lib/domain/scaling";
import { formatNumber } from "@/lib/domain/format";
import type { RoundingMode } from "@/lib/domain/quantity";
import type { ScalerIngredient, ScalerStep } from "../../recipe-scaler";

const SYSTEMS: { value: DisplaySystem; label: string }[] = [
  { value: "original", label: "As written" },
  { value: "imperial", label: "Imperial" },
  { value: "metric", label: "Metric" },
];

export function CookMode({
  recipeId,
  recipeName,
  baseServings,
  defaultSystem,
  rounding,
  ingredients,
  steps,
}: {
  recipeId: number;
  recipeName: string;
  baseServings: number;
  defaultSystem: "imperial" | "metric";
  rounding: RoundingMode;
  ingredients: ScalerIngredient[];
  steps: ScalerStep[];
}) {
  const [index, setIndex] = React.useState(0);
  const [target, setTarget] = React.useState(baseServings);
  const [system, setSystem] = React.useState<DisplaySystem>(defaultSystem);
  const [showIngredients, setShowIngredients] = React.useState(false);

  const factor = scaleFactor(baseServings, target);
  const densityFor = (id: number | null) => {
    if (id == null) return undefined;
    return ingredients.find((i) => i.ingredientId === id)?.density ?? undefined;
  };
  const opts = { factor, system, rounding };

  const last = Math.max(0, steps.length - 1);
  const next = React.useCallback(() => setIndex((i) => Math.min(i + 1, last)), [last]);
  const prev = React.useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  // Keyboard navigation.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  // Keep the screen awake while cooking (best-effort; ignored where unsupported).
  React.useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    let released = false;
    const wakeLock = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    async function acquire() {
      try {
        if (wakeLock && !released) lock = await wakeLock.request("screen");
      } catch {
        /* ignore */
      }
    }
    void acquire();
    function onVisible() {
      if (document.visibilityState === "visible") void acquire();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => {});
    };
  }, []);

  const setServings = (n: number) => setTarget(Math.max(0.25, Math.round(n * 100) / 100));

  return (
    <div className="flex min-h-[80vh] flex-col">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="min-w-0">
          <div className="truncate text-sm text-muted-foreground">Cooking</div>
          <div className="truncate text-lg font-medium">{recipeName}</div>
        </div>
        <Link href={`/recipes/${recipeId}`} className="text-sm text-muted-foreground hover:text-foreground">
          <span className="inline-flex items-center gap-1"><XIcon className="size-4" /> Exit</span>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Serves</span>
          <div className="flex items-center rounded-md border">
            <Button variant="ghost" size="icon" aria-label="Fewer servings" onClick={() => setServings(target - 1)}>
              <MinusIcon className="size-4" />
            </Button>
            <span className="w-10 text-center text-sm font-medium tabular-nums">{formatNumber(target)}</span>
            <Button variant="ghost" size="icon" aria-label="More servings" onClick={() => setServings(target + 1)}>
              <PlusIcon className="size-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center rounded-md border p-0.5">
          {SYSTEMS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSystem(s.value)}
              className={cn(
                "rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
                system === s.value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowIngredients((v) => !v)}>
          {showIngredients ? "Hide" : "Show"} ingredients
        </Button>
      </div>

      {showIngredients && (
        <ul className="mb-4 grid gap-1 rounded-lg border p-3 text-base sm:grid-cols-2">
          {ingredients.map((ing) => {
            const qty = displayQuantity(
              { amount: ing.amount, amountMax: ing.amountMax, unit: ing.unit, raw: ing.raw },
              { ...opts, density: ing.density ?? undefined },
            );
            return (
              <li key={ing.id}>
                {qty && <span className="tabular-nums">{qty} </span>}
                <span className="font-medium">{ing.name}</span>
                {ing.prep && <span className="text-muted-foreground"> — {ing.prep}</span>}
              </li>
            );
          })}
        </ul>
      )}

      {/* Current step — large */}
      <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
        {steps.length === 0 ? (
          <p className="text-muted-foreground">This recipe has no steps.</p>
        ) : (
          <>
            <div className="mb-4 text-sm font-medium text-muted-foreground">
              Step {index + 1} of {steps.length}
            </div>
            <p className="max-w-2xl text-2xl leading-relaxed sm:text-3xl">{renderStep(steps[index], { ...opts, densityFor })}</p>
          </>
        )}
      </div>

      {/* Navigation */}
      {steps.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-t pt-3">
          <Button variant="outline" size="lg" onClick={prev} disabled={index === 0}>
            <ChevronLeftIcon className="size-5" /> Back
          </Button>
          <div className="flex gap-1">
            {steps.map((s, i) => (
              <button
                key={s.id}
                type="button"
                aria-label={`Go to step ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn("size-2.5 rounded-full transition-colors", i === index ? "bg-primary" : "bg-muted")}
              />
            ))}
          </div>
          {index < last ? (
            <Button size="lg" onClick={next}>
              Next <ChevronRightIcon className="size-5" />
            </Button>
          ) : (
            <Link href={`/recipes/${recipeId}`} className="inline-flex">
              <Button size="lg">Done</Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

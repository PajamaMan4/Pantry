"use client";

import * as React from "react";
import Link from "next/link";
import { MinusIcon, PlusIcon, RotateCcwIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { scaleFactor, displayQuantity, renderStep, type DisplaySystem } from "@/lib/domain/scaling";
import { formatNumber } from "@/lib/domain/format";
import type { RoundingMode } from "@/lib/domain/quantity";
import { planCook, type CookIngredientInput, type CookStockRow } from "@/lib/domain/cook";
import { groupRowsBySection } from "@/lib/domain/sections";
import { CookButton } from "./cook-button";

export type ScalerIngredient = {
  id: number; // recipe_ingredients row id (React key)
  ingredientId: number; // master ingredient id (for step density lookup)
  name: string;
  amount: number | null;
  amountMax: number | null;
  unit: string | null;
  raw: string | null;
  prep: string | null;
  optional: boolean;
  isStaple: boolean;
  density: number | null;
  sectionTitle: string | null;
};

export type ScalerStep = {
  id: string;
  text: string;
  quantities?: Record<
    string,
    { ingredientId: number | null; amount: number; amountMax?: number | null; unit: string | null }
  >;
};

type Props = {
  recipeId: number;
  baseServings: number;
  ingredients: ScalerIngredient[];
  steps: ScalerStep[];
  defaultSystem: "imperial" | "metric";
  rounding: RoundingMode;
  cookIngredients: CookIngredientInput[];
  cookStock: { ingredientId: number; rows: CookStockRow[] }[];
};

const SYSTEMS: { value: DisplaySystem; label: string }[] = [
  { value: "original", label: "As written" },
  { value: "imperial", label: "Imperial" },
  { value: "metric", label: "Metric" },
];

export function RecipeScaler({
  recipeId,
  baseServings,
  ingredients,
  steps,
  defaultSystem,
  rounding,
  cookIngredients,
  cookStock,
}: Props) {
  const [target, setTarget] = React.useState(baseServings);
  const [system, setSystem] = React.useState<DisplaySystem>(defaultSystem);
  const [checkedSteps, setCheckedSteps] = React.useState<Set<string>>(new Set());

  const toggleStep = (id: string) =>
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const factor = scaleFactor(baseServings, target);

  const densityById = React.useMemo(() => {
    const m = new Map<number, number>();
    for (const ing of ingredients) if (ing.density != null) m.set(ing.ingredientId, ing.density);
    return m;
  }, [ingredients]);
  const densityFor = React.useCallback(
    (id: number | null) => (id == null ? undefined : densityById.get(id)),
    [densityById],
  );

  const opts = { factor, system, rounding };
  const setServings = (n: number) => setTarget(Math.max(0.25, Math.round(n * 100) / 100));

  // Computed directly — the React Compiler memoizes these automatically.
  const stockMap = new Map(cookStock.map((s) => [s.ingredientId, s.rows]));
  const plan = planCook(cookIngredients, stockMap, factor);

  return (
    <div>
      <div className="mb-3">
        <CookButton
          recipeId={recipeId}
          baseServings={baseServings}
          servings={target}
          ingredients={cookIngredients}
          stock={cookStock}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Servings stepper */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Serves</span>
          <div className="flex items-center rounded-md border">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Fewer servings"
              onClick={() => setServings(target - 1)}
            >
              <MinusIcon className="size-4" />
            </Button>
            <span className="w-10 text-center text-sm font-medium tabular-nums">
              {formatNumber(target)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="More servings"
              onClick={() => setServings(target + 1)}
            >
              <PlusIcon className="size-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setServings(target * 2)}>
            ×2
          </Button>
          <Button variant="outline" size="sm" onClick={() => setServings(target / 2)}>
            ×½
          </Button>
          {target !== baseServings && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Reset servings"
              onClick={() => setTarget(baseServings)}
            >
              <RotateCcwIcon className="size-4" /> Reset
            </Button>
          )}
        </div>

        {/* Unit-system toggle */}
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
      </div>

      {factor !== 1 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Scaled ×{formatNumber(Math.round(factor * 100) / 100)} from {formatNumber(baseServings)} servings.
        </p>
      )}

      <Separator className="my-6" />

      <section>
        <h2 className="mb-3 text-lg font-medium">Ingredients</h2>
        {ingredients.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ingredients listed.</p>
        ) : (
          // Group into sections for multi-part recipes; a flat list collapses to a
          // single untitled group. `index` stays aligned with plan.lines (the
          // inventory-match status is computed over the full flat list).
          <div className="space-y-4">
            {groupRowsBySection(ingredients, (ing) => ing.sectionTitle).map((group, gi) => (
              <div key={group.title ?? `__flat-${gi}`}>
                {group.title && (
                  <h3 className="mb-1.5 text-sm font-semibold text-muted-foreground">{group.title}</h3>
                )}
                <ul className="space-y-1.5">
                  {group.items.map(({ row: ing, index: i }) => {
                    const qty = displayQuantity(
                      { amount: ing.amount, amountMax: ing.amountMax, unit: ing.unit, raw: ing.raw },
                      { ...opts, density: ing.density ?? undefined },
                    );
                    const status = plan.lines[i]?.status;
                    const hasStock = (stockMap.get(ing.ingredientId) ?? []).some((r) => r.quantity > 0);
                    return (
                      <li key={ing.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                        {status === "ok" && <span aria-label="In stock" title="In stock">✅</span>}
                        {(status === "partial" || status === "missing") && (
                          <span aria-label="Not enough in stock" title="Not enough in stock">
                            ❌
                          </span>
                        )}
                        {status === "skipped" && (
                          ing.isStaple ? (
                            <span aria-label="Staple (always in stock)" title="Staple (always in stock)">✅</span>
                          ) : hasStock ? (
                            <span aria-label="In stock" title="In stock">✅</span>
                          ) : (
                            <span aria-label="Not in stock" title="Not in stock">❌</span>
                          )
                        )}
                        <Link href={`/ingredients/${ing.ingredientId}`} className="font-medium hover:underline">
                          {ing.name}
                        </Link>
                        {qty && <span className="tabular-nums text-foreground">{qty}</span>}
                        {ing.prep && <span className="text-muted-foreground">— {ing.prep}</span>}
                        {ing.optional && (
                          <Badge variant="outline" className="text-[10px]">
                            optional
                          </Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <Separator className="my-6" />

      <section>
        <h2 className="mb-3 text-lg font-medium">Steps</h2>
        {steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">No steps yet.</p>
        ) : (
          <ol className="space-y-3">
            {steps.map((step, i) => {
              const done = checkedSteps.has(step.id);
              return (
                <li key={step.id} className="flex gap-3">
                  <button
                    type="button"
                    aria-label={done ? `Uncheck step ${i + 1}` : `Check step ${i + 1}`}
                    onClick={() => toggleStep(step.id)}
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors",
                      done
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/70",
                    )}
                  >
                    {done ? <CheckIcon className="size-3.5" /> : i + 1}
                  </button>
                  <p
                    className={cn(
                      "text-sm leading-relaxed whitespace-pre-wrap transition-colors",
                      done && "text-muted-foreground line-through",
                    )}
                  >
                    {renderStep(step, { ...opts, densityFor })}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

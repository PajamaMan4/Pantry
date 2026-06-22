"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
  CheckIcon,
  ArrowLeftRightIcon,
  ArrowRightIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { scaleFactor, displayQuantity, renderStep, type DisplaySystem } from "@/lib/domain/scaling";
import { formatNumber } from "@/lib/domain/format";
import { UNIT_OPTIONS } from "@/lib/domain/units";
import type { RoundingMode } from "@/lib/domain/quantity";
import { planCook, type CookIngredientInput, type CookStockRow } from "@/lib/domain/cook";
import { groupRowsBySection } from "@/lib/domain/sections";
import { IngredientPicker } from "@/components/ingredient-picker";
import type { IngredientOption } from "@/components/ingredient-combobox";
import { CookButton } from "./cook-button";
import { getSubstituteInfoAction } from "./actions";

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

/**
 * A temporary, in-view ingredient swap keyed by the original recipe_ingredients
 * row id. Never persisted — it just overrides that line's inputs to the existing
 * scaling + cook-plan pipelines. `amountText` defaults to the original line's
 * amount and is user-editable.
 */
type Substitution = {
  ingredientId: number;
  name: string;
  amountText: string;
  unit: string | null;
  density: number | null;
  gramsPerEach: number | null;
  isStaple: boolean;
  stock: CookStockRow[];
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
  ingredientOptions: IngredientOption[];
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
  ingredientOptions,
}: Props) {
  const [target, setTarget] = React.useState(baseServings);
  const [system, setSystem] = React.useState<DisplaySystem>(defaultSystem);
  const [checkedSteps, setCheckedSteps] = React.useState<Set<string>>(new Set());
  const [subMode, setSubMode] = React.useState(false);
  // keyed by the original recipe_ingredients row id (ScalerIngredient.id)
  const [subs, setSubs] = React.useState<Map<number, Substitution>>(new Map());
  const [loadingRow, setLoadingRow] = React.useState<number | null>(null);

  const toggleStep = (id: string) =>
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // --- Substitution handlers -------------------------------------------------
  async function pickSubstitute(row: ScalerIngredient, ingredientId: number) {
    setLoadingRow(row.id);
    try {
      const res = await getSubstituteInfoAction(ingredientId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const info = res.info;
      setSubs((prev) => {
        const next = new Map(prev);
        const existing = next.get(row.id);
        next.set(row.id, {
          ingredientId: info.id,
          name: info.name,
          // Keep amount/unit overrides across a re-pick; otherwise inherit the
          // original line's amount/unit so only the name changes by default.
          amountText: existing?.amountText ?? (row.amount == null ? "" : String(row.amount)),
          unit: existing?.unit ?? row.unit ?? info.defaultUnit,
          density: info.density,
          gramsPerEach: info.gramsPerEach,
          isStaple: info.isStaple,
          stock: info.stock,
        });
        return next;
      });
    } finally {
      setLoadingRow(null);
    }
  }

  const patchSub = (rowId: number, patch: Partial<Substitution>) =>
    setSubs((prev) => {
      const cur = prev.get(rowId);
      if (!cur) return prev;
      const next = new Map(prev);
      next.set(rowId, { ...cur, ...patch });
      return next;
    });

  const clearSub = (rowId: number) =>
    setSubs((prev) => {
      const next = new Map(prev);
      next.delete(rowId);
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

  // Substitution is an override applied to the inputs of the existing pipelines:
  // the ingredients list renders over `effectiveIngredients`, and stock status
  // comes from re-running planCook over the substituted cook inputs + stock.
  const subAmount = (s: Substitution) => {
    if (s.amountText.trim() === "") return null;
    const n = Number(s.amountText);
    return Number.isFinite(n) ? n : null;
  };

  const effectiveIngredients = React.useMemo(
    () =>
      ingredients.map((ing) => {
        const s = subs.get(ing.id);
        if (!s) return ing;
        return {
          ...ing,
          ingredientId: s.ingredientId,
          name: s.name,
          amount: subAmount(s),
          amountMax: null,
          unit: s.unit,
          raw: null,
          density: s.density,
          isStaple: s.isStaple,
        };
      }),
    [ingredients, subs],
  );

  const { effectiveCookIngredients, effectiveStockMap } = React.useMemo(() => {
    const stock = new Map(cookStock.map((s) => [s.ingredientId, [...s.rows]]));
    const cooks = cookIngredients.map((ci, i) => {
      const row = ingredients[i];
      const s = row ? subs.get(row.id) : undefined;
      if (!s) return ci;
      return {
        ...ci,
        ingredientId: s.ingredientId,
        name: s.name,
        amount: subAmount(s),
        unit: s.unit,
        isStaple: s.isStaple,
        density: s.density,
        gramsPerEach: s.gramsPerEach,
      };
    });
    for (const s of subs.values()) {
      if (!stock.has(s.ingredientId)) stock.set(s.ingredientId, s.stock);
    }
    return { effectiveCookIngredients: cooks, effectiveStockMap: stock };
  }, [cookIngredients, ingredients, cookStock, subs]);

  const plan = planCook(effectiveCookIngredients, effectiveStockMap, factor);

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

      <div className="mt-3 flex items-center gap-2">
        <Button
          variant={subMode ? "default" : "outline"}
          size="sm"
          onClick={() => setSubMode((v) => !v)}
        >
          <ArrowLeftRightIcon className="size-4" /> {subMode ? "Done" : "Substitute"}
        </Button>
        {subs.size > 0 && (
          <>
            <span className="text-xs text-muted-foreground">
              {subs.size} swap{subs.size === 1 ? "" : "s"}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setSubs(new Map())}>
              Clear swaps
            </Button>
          </>
        )}
      </div>

      <Separator className="my-6" />

      <section>
        <h2 className="mb-3 text-lg font-medium">Ingredients</h2>
        {ingredients.length === 0 ? (
          <p className="text-sm text-muted-foreground">No ingredients listed.</p>
        ) : subMode ? (
          // Edit mode: pick a replacement (from the catalog) and tweak its
          // amount/unit per line. Iterates the *original* rows so each shows its
          // original name as the label for the swap.
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Swap an ingredient for tonight — these changes aren’t saved to the recipe.
            </p>
            {groupRowsBySection(ingredients, (ing) => ing.sectionTitle).map((group, gi) => (
              <div key={group.title ?? `__flat-${gi}`}>
                {group.title && (
                  <h3 className="mb-1.5 text-sm font-semibold text-muted-foreground">{group.title}</h3>
                )}
                <ul className="space-y-2">
                  {group.items.map(({ row: ing }) => {
                    const sub = subs.get(ing.id);
                    return (
                      <li key={ing.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className={cn("font-medium", sub && "text-muted-foreground line-through")}>
                          {ing.name}
                        </span>
                        <ArrowRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                        <div className="min-w-48 flex-1">
                          <IngredientPicker
                            initialOptions={ingredientOptions}
                            selectedName={sub?.name ?? ""}
                            placeholder="Keep original — or search a swap…"
                            onType={() => {}}
                            onPick={(p) => {
                              if (p.id != null) void pickSubstitute(ing, p.id);
                            }}
                          />
                        </div>
                        {loadingRow === ing.id && (
                          <span className="text-xs text-muted-foreground">…</span>
                        )}
                        {sub && (
                          <>
                            <Input
                              type="number"
                              inputMode="decimal"
                              className="h-9 w-20"
                              value={sub.amountText}
                              onChange={(e) => patchSub(ing.id, { amountText: e.target.value })}
                              aria-label={`Amount for ${sub.name}`}
                            />
                            <select
                              value={sub.unit ?? ""}
                              onChange={(e) => patchSub(ing.id, { unit: e.target.value || null })}
                              aria-label={`Unit for ${sub.name}`}
                              className="h-9 rounded-md border bg-transparent px-2 text-sm"
                            >
                              <option value="">—</option>
                              {UNIT_OPTIONS.map((u) => (
                                <option key={u.value} value={u.value}>
                                  {u.label}
                                </option>
                              ))}
                            </select>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Remove substitution for ${ing.name}`}
                              onClick={() => clearSub(ing.id)}
                            >
                              <XIcon className="size-4" />
                            </Button>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          // Applied view: render over `effectiveIngredients` (swaps applied). The
          // `index` stays aligned with plan.lines (status computed over the same
          // effective flat list), and the original name is recovered by index.
          <div className="space-y-4">
            {groupRowsBySection(effectiveIngredients, (ing) => ing.sectionTitle).map((group, gi) => (
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
                    const hasStock = (effectiveStockMap.get(ing.ingredientId) ?? []).some((r) => r.quantity > 0);
                    const sub = subs.get(ing.id);
                    const original = sub ? ingredients[i] : null;
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
                        {sub && original && (
                          <>
                            <Badge variant="secondary" className="text-[10px]">
                              swap
                            </Badge>
                            <span className="text-xs text-muted-foreground line-through">{original.name}</span>
                          </>
                        )}
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

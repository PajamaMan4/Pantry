"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { PlusIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  IngredientCombobox,
  type IngredientOption,
} from "@/components/ingredient-combobox";
import { TagInput } from "@/components/tag-input";
import { UNIT_OPTIONS } from "@/lib/domain/units";
import {
  createRecipeAction,
  updateRecipeAction,
  createIngredientAction,
} from "./actions";

// ---- Form state types -------------------------------------------------------
type IngredientRow = {
  key: string;
  ingredientId: number | null;
  ingredientName: string;
  amount: string;
  amountMax: string;
  unit: string;
  raw: string;
  prep: string;
  optional: boolean;
};

type StepRow = { id: string; text: string };

export type RecipeFormInitial = {
  id: number;
  name: string;
  description: string | null;
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  baseServings: number;
  notes: string | null;
  isFavorite: boolean;
  tags: string[];
  ingredients: {
    ingredientId: number;
    ingredientName: string;
    amount: number | null;
    amountMax: number | null;
    unit: string | null;
    raw: string | null;
    prep: string | null;
    optional: boolean;
  }[];
  steps: StepRow[];
};

type Props = {
  ingredientOptions: IngredientOption[];
  tagSuggestions: string[];
  initial?: RecipeFormInitial;
};

const numToStr = (n: number | null | undefined) => (n == null ? "" : String(n));

function emptyRow(): IngredientRow {
  return {
    key: nanoid(),
    ingredientId: null,
    ingredientName: "",
    amount: "",
    amountMax: "",
    unit: "",
    raw: "",
    prep: "",
    optional: false,
  };
}

export function RecipeForm({ ingredientOptions, tagSuggestions, initial }: Props) {
  const router = useRouter();
  const isEdit = initial != null;

  const [options, setOptions] = React.useState<IngredientOption[]>(ingredientOptions);
  const [name, setName] = React.useState(initial?.name ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [prep, setPrep] = React.useState(numToStr(initial?.prepTimeMin));
  const [cook, setCook] = React.useState(numToStr(initial?.cookTimeMin));
  const [servings, setServings] = React.useState(numToStr(initial?.baseServings ?? 1) || "1");
  const [notes, setNotes] = React.useState(initial?.notes ?? "");
  const [isFavorite, setIsFavorite] = React.useState(initial?.isFavorite ?? false);
  const [tags, setTags] = React.useState<string[]>(initial?.tags ?? []);

  const [rows, setRows] = React.useState<IngredientRow[]>(
    initial && initial.ingredients.length > 0
      ? initial.ingredients.map((r) => ({
          key: nanoid(),
          ingredientId: r.ingredientId,
          ingredientName: r.ingredientName,
          amount: numToStr(r.amount),
          amountMax: numToStr(r.amountMax),
          unit: r.unit ?? "",
          raw: r.raw ?? "",
          prep: r.prep ?? "",
          optional: r.optional,
        }))
      : [emptyRow()],
  );

  const [steps, setSteps] = React.useState<StepRow[]>(
    initial && initial.steps.length > 0 ? initial.steps : [{ id: nanoid(), text: "" }],
  );

  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  // ---- row helpers ----
  function patchRow(key: string, patch: Partial<IngredientRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function createIngredientForRow(key: string, ingName: string) {
    const res = await createIngredientAction({ name: ingName });
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const opt: IngredientOption = {
      id: res.ingredient.id,
      name: res.ingredient.name,
      defaultUnit: res.ingredient.defaultUnit,
    };
    setOptions((prev) => (prev.some((o) => o.id === opt.id) ? prev : [...prev, opt]));
    setRows((rs) =>
      rs.map((r) =>
        r.key === key
          ? {
              ...r,
              ingredientId: opt.id,
              ingredientName: opt.name,
              unit: r.unit || opt.defaultUnit || "",
            }
          : r,
      ),
    );
  }

  // ---- step helpers ----
  function patchStep(id: string, text: string) {
    setSteps((ss) => ss.map((s) => (s.id === id ? { ...s, text } : s)));
  }
  function moveStep(index: number, dir: -1 | 1) {
    setSteps((ss) => {
      const next = [...ss];
      const target = index + dir;
      if (target < 0 || target >= next.length) return ss;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function submit() {
    setError(null);
    const cleanedRows = rows.filter(
      (r) => r.ingredientId != null || r.ingredientName.trim() !== "",
    );
    const cleanedSteps = steps
      .map((s) => ({ id: s.id, text: s.text.trim() }))
      .filter((s) => s.text !== "");

    const input = {
      name,
      description,
      prepTimeMin: prep,
      cookTimeMin: cook,
      baseServings: servings,
      notes,
      isFavorite,
      tags,
      ingredients: cleanedRows.map((r) => ({
        ingredientId: r.ingredientId,
        name: r.ingredientName,
        amount: r.amount,
        amountMax: r.amountMax,
        unit: r.unit,
        raw: r.raw,
        prep: r.prep,
        optional: r.optional,
      })),
      steps: cleanedSteps,
    };

    startTransition(async () => {
      const res = isEdit
        ? await updateRecipeAction(initial!.id, input)
        : await createRecipeAction(input);
      // On success the action redirects; only failures return here.
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-8">
      {/* Metadata */}
      <section className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Recipe name" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            rows={2}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="prep">Prep (min)</Label>
            <Input id="prep" type="number" min={0} value={prep} onChange={(e) => setPrep(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cook">Cook (min)</Label>
            <Input id="cook" type="number" min={0} value={cook} onChange={(e) => setCook(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="servings">Servings</Label>
            <Input
              id="servings"
              type="number"
              min={0}
              step="0.5"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Tags</Label>
          <TagInput value={tags} suggestions={tagSuggestions} onChange={setTags} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={isFavorite} onCheckedChange={(v) => setIsFavorite(v === true)} />
          Mark as favorite
        </label>
      </section>

      <Separator />

      {/* Ingredients */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Ingredients</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, emptyRow()])}>
            <PlusIcon className="size-4" /> Add ingredient
          </Button>
        </div>

        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.key} className="rounded-lg border p-3">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-56 flex-1">
                  <IngredientCombobox
                    options={options}
                    selectedName={row.ingredientName}
                    onType={(n) => patchRow(row.key, { ingredientName: n, ingredientId: null })}
                    onSelect={(opt) =>
                      patchRow(row.key, {
                        ingredientId: opt.id,
                        ingredientName: opt.name,
                        unit: row.unit || opt.defaultUnit || "",
                      })
                    }
                    onCreate={(n) => createIngredientForRow(row.key, n)}
                  />
                </div>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  className="w-20"
                  placeholder="amt"
                  value={row.amount}
                  onChange={(e) => patchRow(row.key, { amount: e.target.value })}
                />
                <span className="pt-2 text-muted-foreground">–</span>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  className="w-20"
                  placeholder="max"
                  value={row.amountMax}
                  onChange={(e) => patchRow(row.key, { amountMax: e.target.value })}
                />
                <select
                  className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                  value={row.unit}
                  onChange={(e) => patchRow(row.key, { unit: e.target.value })}
                  aria-label="Unit"
                >
                  <option value="">unit…</option>
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove ingredient"
                  onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== row.key) : rs))}
                >
                  <TrashIcon className="size-4" />
                </Button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Input
                  className="w-40"
                  placeholder="prep, e.g. diced"
                  value={row.prep}
                  onChange={(e) => patchRow(row.key, { prep: e.target.value })}
                />
                <Input
                  className="w-44"
                  placeholder="or text, e.g. to taste"
                  value={row.raw}
                  onChange={(e) => patchRow(row.key, { raw: e.target.value })}
                />
                <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Checkbox
                    checked={row.optional}
                    onCheckedChange={(v) => patchRow(row.key, { optional: v === true })}
                  />
                  optional
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Separator />

      {/* Steps (plain text in Phase 1; quantity-linking arrives in Phase 2) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Steps</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSteps((ss) => [...ss, { id: nanoid(), text: "" }])}
          >
            <PlusIcon className="size-4" /> Add step
          </Button>
        </div>

        <ol className="space-y-2">
          {steps.map((step, i) => (
            <li key={step.id} className="flex items-start gap-2">
              <span className="mt-2 w-5 text-right text-sm text-muted-foreground">{i + 1}.</span>
              <Textarea
                value={step.text}
                onChange={(e) => patchStep(step.id, e.target.value)}
                placeholder="Describe this step"
                rows={2}
                className="flex-1"
              />
              <div className="flex flex-col">
                <Button type="button" variant="ghost" size="icon" aria-label="Move up" onClick={() => moveStep(i, -1)}>
                  <ArrowUpIcon className="size-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" aria-label="Move down" onClick={() => moveStep(i, 1)}>
                  <ArrowDownIcon className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove step"
                  onClick={() => setSteps((ss) => (ss.length > 1 ? ss.filter((s) => s.id !== step.id) : ss))}
                >
                  <TrashIcon className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Separator />

      {/* Notes */}
      <section className="grid gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything else (optional)"
          rows={3}
        />
      </section>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create recipe"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { PlusIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, LayersIcon } from "lucide-react";

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
import { StepEditor, type EditorStep } from "@/components/step-editor";
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

// Ingredients are edited inside section boxes. A single section with a blank
// title is just a flat, unlabeled list; titled / multiple sections produce a
// multi-part recipe ("For the crust", "For the filling", ...).
type IngredientSection = {
  key: string;
  title: string;
  rows: IngredientRow[];
};

type StepRow = EditorStep;

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
  groupName: string | null;
  ingredients: {
    ingredientId: number;
    ingredientName: string;
    amount: number | null;
    amountMax: number | null;
    unit: string | null;
    raw: string | null;
    prep: string | null;
    optional: boolean;
    sectionTitle: string | null;
  }[];
  steps: StepRow[];
};

type Props = {
  ingredientOptions: IngredientOption[];
  tagSuggestions: string[];
  groupSuggestions: string[];
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

function emptySection(title = ""): IngredientSection {
  return { key: nanoid(), title, rows: [emptyRow()] };
}

// Build the initial section list by grouping the saved ingredients on their
// (contiguous) section title — mirrors how the recipe page renders them.
function initialSections(initial?: RecipeFormInitial): IngredientSection[] {
  if (!initial || initial.ingredients.length === 0) return [emptySection()];

  const sections: IngredientSection[] = [];
  for (const r of initial.ingredients) {
    const title = r.sectionTitle ?? "";
    const row: IngredientRow = {
      key: nanoid(),
      ingredientId: r.ingredientId,
      ingredientName: r.ingredientName,
      amount: numToStr(r.amount),
      amountMax: numToStr(r.amountMax),
      unit: r.unit ?? "",
      raw: r.raw ?? "",
      prep: r.prep ?? "",
      optional: r.optional,
    };
    const last = sections[sections.length - 1];
    if (last && last.title === title) last.rows.push(row);
    else sections.push({ key: nanoid(), title, rows: [row] });
  }
  return sections;
}

export function RecipeForm({ ingredientOptions, tagSuggestions, groupSuggestions, initial }: Props) {
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
  const [groupName, setGroupName] = React.useState(initial?.groupName ?? "");
  const groupListId = React.useId();

  const [sections, setSections] = React.useState<IngredientSection[]>(() => initialSections(initial));

  const [steps, setSteps] = React.useState<StepRow[]>(
    initial && initial.steps.length > 0
      ? initial.steps
      : [{ id: nanoid(), text: "", quantities: {} }],
  );

  // A recipe is "sectioned" once there's more than one box or the single box is
  // titled — drives whether the remove-section control is offered.
  const hasSections = sections.length > 1 || sections.some((s) => s.title.trim() !== "");

  // Ingredients (with a resolved master id) the step linker can attach to.
  const ingredientChoices = React.useMemo(() => {
    const seen = new Set<number>();
    const out: { id: number; name: string }[] = [];
    for (const sec of sections) {
      for (const r of sec.rows) {
        if (r.ingredientId != null && !seen.has(r.ingredientId)) {
          seen.add(r.ingredientId);
          out.push({ id: r.ingredientId, name: r.ingredientName });
        }
      }
    }
    return out;
  }, [sections]);

  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  // ---- section / row helpers ----
  function patchSection(sectionKey: string, patch: Partial<IngredientSection>) {
    setSections((ss) => ss.map((s) => (s.key === sectionKey ? { ...s, ...patch } : s)));
  }
  function addSection() {
    setSections((ss) => [...ss, emptySection()]);
  }
  function removeSection(sectionKey: string) {
    setSections((ss) => {
      if (ss.length <= 1) return [emptySection()];
      return ss.filter((s) => s.key !== sectionKey);
    });
  }

  function mapRows(sectionKey: string, fn: (rows: IngredientRow[]) => IngredientRow[]) {
    setSections((ss) => ss.map((s) => (s.key === sectionKey ? { ...s, rows: fn(s.rows) } : s)));
  }
  function addRow(sectionKey: string) {
    mapRows(sectionKey, (rows) => [...rows, emptyRow()]);
  }
  function removeRow(sectionKey: string, rowKey: string) {
    mapRows(sectionKey, (rows) => rows.filter((r) => r.key !== rowKey));
  }
  function patchRow(sectionKey: string, rowKey: string, patch: Partial<IngredientRow>) {
    mapRows(sectionKey, (rows) => rows.map((r) => (r.key === rowKey ? { ...r, ...patch } : r)));
  }
  function moveRow(sectionKey: string, index: number, dir: -1 | 1) {
    mapRows(sectionKey, (rows) => {
      const target = index + dir;
      if (target < 0 || target >= rows.length) return rows;
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function createIngredientForRow(sectionKey: string, rowKey: string, ingName: string) {
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
    // Link the row to the new ingredient, filling its unit from the default when blank.
    mapRows(sectionKey, (rows) =>
      rows.map((r) =>
        r.key === rowKey
          ? { ...r, ingredientId: opt.id, ingredientName: opt.name, unit: r.unit || opt.defaultUnit || "" }
          : r,
      ),
    );
  }

  // ---- step helpers ----
  function patchStep(next: StepRow) {
    setSteps((ss) => ss.map((s) => (s.id === next.id ? next : s)));
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
    // Flatten sections in order; a blank title means "ungrouped" (null).
    const ingredients = sections.flatMap((sec) => {
      const title = sec.title.trim();
      return sec.rows
        .filter((r) => r.ingredientId != null || r.ingredientName.trim() !== "")
        .map((r) => ({
          ingredientId: r.ingredientId,
          name: r.ingredientName,
          amount: r.amount,
          amountMax: r.amountMax,
          unit: r.unit,
          raw: r.raw,
          prep: r.prep,
          optional: r.optional,
          sectionTitle: title === "" ? null : title,
        }));
    });

    const cleanedSteps = steps
      .map((s) => ({ id: s.id, text: s.text.trim(), quantities: s.quantities }))
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
      groupName: groupName.trim() === "" ? null : groupName.trim(),
      ingredients,
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
        <div className="grid gap-2">
          <Label htmlFor="group">Variant group</Label>
          <Input
            id="group"
            list={groupListId}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="e.g. Alfredo Pasta — leave blank for a standalone recipe"
          />
          <datalist id={groupListId}>
            {groupSuggestions.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
          <p className="text-xs text-muted-foreground">
            Recipes sharing a group are shown together as variants of one another.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={isFavorite} onCheckedChange={(v) => setIsFavorite(v === true)} />
          Mark as favorite
        </label>
      </section>

      <Separator />

      {/* Ingredients — grouped into optional section boxes */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Ingredients</h2>
          <Button type="button" variant="outline" size="sm" onClick={addSection}>
            <LayersIcon className="size-4" /> Add section
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Name a section (e.g. “For the crust”) to group a multi-part recipe, or leave the title blank
          for a simple list.
        </p>

        <div className="space-y-4">
          {sections.map((section) => (
            <div key={section.key} className="space-y-3 rounded-lg border bg-muted/30 p-3">
              {/* Section header: title + remove */}
              <div className="flex items-center gap-2">
                <Input
                  className="flex-1 bg-background font-medium"
                  placeholder="Section name (optional) — e.g. For the filling"
                  value={section.title}
                  onChange={(e) => patchSection(section.key, { title: e.target.value })}
                  aria-label="Section name"
                />
                {hasSections && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove section"
                    title="Remove section"
                    onClick={() => removeSection(section.key)}
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                )}
              </div>

              {/* Ingredient rows for this section */}
              <div className="space-y-3">
                {section.rows.map((row, i) => (
                  <div key={row.key} className="rounded-md border bg-background p-3">
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="min-w-56 flex-1">
                        <IngredientCombobox
                          options={options}
                          selectedName={row.ingredientName}
                          onType={(n) => patchRow(section.key, row.key, { ingredientName: n, ingredientId: null })}
                          onSelect={(opt) =>
                            patchRow(section.key, row.key, {
                              ingredientId: opt.id,
                              ingredientName: opt.name,
                              unit: row.unit || opt.defaultUnit || "",
                            })
                          }
                          onCreate={(n) => createIngredientForRow(section.key, row.key, n)}
                        />
                      </div>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        className="w-20"
                        placeholder="amt"
                        value={row.amount}
                        onChange={(e) => patchRow(section.key, row.key, { amount: e.target.value })}
                      />
                      <span className="pt-2 text-muted-foreground">–</span>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        className="w-20"
                        placeholder="max"
                        value={row.amountMax}
                        onChange={(e) => patchRow(section.key, row.key, { amountMax: e.target.value })}
                      />
                      <select
                        className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                        value={row.unit}
                        onChange={(e) => patchRow(section.key, row.key, { unit: e.target.value })}
                        aria-label="Unit"
                      >
                        <option value="">unit…</option>
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Move ingredient up"
                          onClick={() => moveRow(section.key, i, -1)}
                        >
                          <ArrowUpIcon className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Move ingredient down"
                          onClick={() => moveRow(section.key, i, 1)}
                        >
                          <ArrowDownIcon className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remove ingredient"
                          onClick={() => removeRow(section.key, row.key)}
                        >
                          <TrashIcon className="size-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Input
                        className="w-40"
                        placeholder="prep, e.g. diced"
                        value={row.prep}
                        onChange={(e) => patchRow(section.key, row.key, { prep: e.target.value })}
                      />
                      <Input
                        className="w-44"
                        placeholder="or text, e.g. to taste"
                        value={row.raw}
                        onChange={(e) => patchRow(section.key, row.key, { raw: e.target.value })}
                      />
                      <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Checkbox
                          checked={row.optional}
                          onCheckedChange={(v) => patchRow(section.key, row.key, { optional: v === true })}
                        />
                        optional
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <Button type="button" variant="outline" size="sm" onClick={() => addRow(section.key)}>
                <PlusIcon className="size-4" /> Add ingredient
              </Button>
            </div>
          ))}
        </div>
      </section>

      <Separator />

      {/* Steps — plain prose, with one-click quantity linking for scaling (§3.2) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Steps</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSteps((ss) => [...ss, { id: nanoid(), text: "", quantities: {} }])}
          >
            <PlusIcon className="size-4" /> Add step
          </Button>
        </div>

        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={step.id} className="flex items-start gap-2">
              <span className="mt-2 w-5 text-right text-sm text-muted-foreground">{i + 1}.</span>
              <StepEditor value={step} ingredientChoices={ingredientChoices} onChange={patchStep} />
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

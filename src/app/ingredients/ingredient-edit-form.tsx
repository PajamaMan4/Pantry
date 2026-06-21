"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { UNIT_OPTIONS } from "@/lib/domain/units";
import { updateIngredientAction, createIngredientFullAction } from "./actions";

const selectClass = "h-9 rounded-md border border-input bg-transparent px-2 text-sm";

export type IngredientEditInitial = {
  id?: number;
  name: string;
  category: string;
  defaultUnit: string;
  density: string;
  gramsPerEach: string;
  isStaple: boolean;
};

export function IngredientEditForm({ initial }: { initial: IngredientEditInitial }) {
  const isCreate = initial.id == null;
  const [name, setName] = React.useState(initial.name);
  const [category, setCategory] = React.useState(initial.category);
  const [defaultUnit, setDefaultUnit] = React.useState(initial.defaultUnit);
  const [density, setDensity] = React.useState(initial.density);
  const [gramsPerEach, setGramsPerEach] = React.useState(initial.gramsPerEach);
  const [isStaple, setIsStaple] = React.useState(initial.isStaple);
  const [pending, startTransition] = React.useTransition();

  function save() {
    const input = { name, category, defaultUnit, density, gramsPerEach, isStaple };
    startTransition(async () => {
      if (isCreate) {
        // On success this redirects to the new ingredient; only errors return.
        const res = await createIngredientFullAction(input);
        if (res && !res.ok) toast.error(res.error);
      } else {
        const res = await updateIngredientAction(initial.id!, input);
        if (res.ok) toast.success("Ingredient updated");
        else toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="category">Category</Label>
          <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. dairy" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="defaultUnit">Default unit</Label>
          <select id="defaultUnit" className={selectClass} value={defaultUnit} onChange={(e) => setDefaultUnit(e.target.value)}>
            <option value="">none</option>
            {UNIT_OPTIONS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="density">Density (g/ml)</Label>
        <Input
          id="density"
          type="number"
          min={0}
          step="0.01"
          value={density}
          onChange={(e) => setDensity(e.target.value)}
          className="w-40"
          placeholder="optional"
        />
        <p className="text-xs text-muted-foreground">
          Enables volume↔weight conversion (e.g. cups of flour → grams).
        </p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="gramsPerEach">Grams per each (count)</Label>
        <Input
          id="gramsPerEach"
          type="number"
          min={0}
          step="0.1"
          value={gramsPerEach}
          onChange={(e) => setGramsPerEach(e.target.value)}
          className="w-40"
          placeholder="optional"
        />
        <p className="text-xs text-muted-foreground">
          Enables count↔weight conversion (e.g. 2 tomatoes → grams).
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={isStaple} onCheckedChange={(v) => setIsStaple(v === true)} />
        Staple (assumed always on hand)
      </label>

      <Button onClick={save} disabled={pending}>
        {pending ? "Saving…" : isCreate ? "Create ingredient" : "Save ingredient"}
      </Button>
    </div>
  );
}

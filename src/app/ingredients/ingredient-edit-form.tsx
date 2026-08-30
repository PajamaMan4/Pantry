"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { LocationCombobox, type LocationOption } from "@/components/location-combobox";
import { UNIT_OPTIONS } from "@/lib/domain/units";
import { updateIngredientAction, createIngredientFullAction } from "./actions";

const selectClass = "h-8 rounded-md border border-input bg-transparent px-2 text-sm";

export type IngredientEditInitial = {
  id?: number;
  name: string;
  defaultUnit: string;
  density: string;
  gramsPerEach: string;
  defaultLocationId: number | null;
  defaultLocationName: string;
  isStaple: boolean;
};

export function IngredientEditForm({
  initial,
  locations,
}: {
  initial: IngredientEditInitial;
  locations: LocationOption[];
}) {
  const router = useRouter();
  const isCreate = initial.id == null;
  const [name, setName] = React.useState(initial.name);
  const [defaultUnit, setDefaultUnit] = React.useState(initial.defaultUnit);
  const [density, setDensity] = React.useState(initial.density);
  const [gramsPerEach, setGramsPerEach] = React.useState(initial.gramsPerEach);
  const [location, setLocation] = React.useState<{ id: number | null; name: string }>({
    id: initial.defaultLocationId,
    name: initial.defaultLocationName,
  });
  const [isStaple, setIsStaple] = React.useState(initial.isStaple);
  const [pending, startTransition] = React.useTransition();

  function save() {
    // `category` is intentionally absent: the column still exists but is no
    // longer edited, and the edit schema leaves stored values untouched.
    const input = {
      name,
      defaultUnit,
      density,
      gramsPerEach,
      defaultLocationId: location.id,
      defaultLocationName: location.id == null ? location.name : null,
      isStaple,
    };
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

      <div className="grid gap-2">
        <Label htmlFor="defaultUnit">Default unit</Label>
        <select
          id="defaultUnit"
          className={`${selectClass} w-40`}
          value={defaultUnit}
          onChange={(e) => setDefaultUnit(e.target.value)}
        >
          <option value="">none</option>
          {UNIT_OPTIONS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        <Label>Default storage location</Label>
        <div className="w-40">
          <LocationCombobox options={locations} value={location} onChange={setLocation} />
        </div>
        <p className="text-xs text-muted-foreground">
          Prefills the location when you add inventory for this ingredient.
        </p>
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

      <FormActions>
        <Button variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : isCreate ? "Create ingredient" : "Save ingredient"}
        </Button>
      </FormActions>
    </div>
  );
}

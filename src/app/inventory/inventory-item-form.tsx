"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IngredientPicker } from "@/components/ingredient-picker";
import type { IngredientOption } from "@/components/ingredient-combobox";
import { UNIT_OPTIONS } from "@/lib/domain/units";
import { createInventoryItemAction, updateInventoryItemAction } from "./actions";

export type InventoryItemInitial = {
  id: number;
  ingredientId: number;
  ingredientName: string;
  quantity: string;
  unit: string;
  locationId: string;
  expiryDate: string;
  openedDate: string;
  notes: string;
};

type LocationOption = { id: number; name: string };

const selectClass = "h-9 rounded-md border border-input bg-transparent px-2 text-sm";

export function InventoryItemForm({
  ingredientOptions,
  locations,
  initial,
}: {
  ingredientOptions: IngredientOption[];
  locations: LocationOption[];
  initial?: InventoryItemInitial;
}) {
  const router = useRouter();
  const isEdit = initial != null;

  const [ingredientId, setIngredientId] = React.useState<number | null>(initial?.ingredientId ?? null);
  const [ingredientName, setIngredientName] = React.useState(initial?.ingredientName ?? "");
  const [quantity, setQuantity] = React.useState(initial?.quantity ?? "");
  const [unit, setUnit] = React.useState(initial?.unit ?? "");
  const [locationId, setLocationId] = React.useState(initial?.locationId ?? "");
  const [expiryDate, setExpiryDate] = React.useState(initial?.expiryDate ?? "");
  const [openedDate, setOpenedDate] = React.useState(initial?.openedDate ?? "");
  const [notes, setNotes] = React.useState(initial?.notes ?? "");

  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit() {
    setError(null);
    const input = {
      ingredientId,
      name: ingredientName,
      quantity,
      unit,
      locationId: locationId || null,
      expiryDate,
      openedDate,
      notes,
    };
    startTransition(async () => {
      const res = isEdit
        ? await updateInventoryItemAction(initial!.id, input)
        : await createInventoryItemAction(input);
      if (res && !res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label>Ingredient</Label>
        <IngredientPicker
          initialOptions={ingredientOptions}
          selectedName={ingredientName}
          onType={(n) => {
            setIngredientName(n);
            setIngredientId(null);
          }}
          onPick={(p) => {
            setIngredientId(p.id);
            setIngredientName(p.name);
            if (!unit && p.defaultUnit) setUnit(p.defaultUnit);
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="quantity">Quantity</Label>
          <Input id="quantity" type="number" min={0} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="unit">Unit</Label>
          <select id="unit" className={selectClass} value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="">unit…</option>
            {UNIT_OPTIONS.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="location">Location</Label>
        <select id="location" className={selectClass} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
          <option value="">(no location)</option>
          {locations.map((l) => (
            <option key={l.id} value={String(l.id)}>
              {l.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="expiry">Expiry date</Label>
          <Input id="expiry" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="opened">Opened date</Label>
          <Input id="opened" type="date" value={openedDate} onChange={(e) => setOpenedDate(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Add to inventory"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocationCombobox, type LocationOption } from "@/components/location-combobox";
import { UNIT_OPTIONS } from "@/lib/domain/units";
import { createInventoryItemAction, updateInventoryItemAction } from "./actions";

const selectClass = "h-8 rounded-md border border-input bg-transparent px-2 text-sm";

export type InventoryEntryInitial = {
  id: number;
  quantity: string;
  unit: string;
  locationId: number | null;
  locationName: string;
  expiryDate: string;
  openedDate: string;
  notes: string;
};

export function InventoryEntryForm({
  ingredientId,
  locations,
  defaultUnit,
  defaultLocation,
  initial,
  onDone,
  onCancel,
  showLocation = true,
}: {
  ingredientId: number;
  locations: LocationOption[];
  defaultUnit: string | null;
  defaultLocation?: { id: number | null; name: string };
  initial?: InventoryEntryInitial;
  onDone: () => void;
  onCancel: () => void;
  showLocation?: boolean;
}) {
  const isEdit = initial != null;
  const [quantity, setQuantity] = React.useState(initial?.quantity ?? "");
  const [unit, setUnit] = React.useState(initial?.unit ?? defaultUnit ?? "");
  const [location, setLocation] = React.useState<{ id: number | null; name: string }>(
    isEdit
      ? { id: initial.locationId, name: initial.locationName }
      : (defaultLocation ?? { id: null, name: "" }),
  );
  const [expiryDate, setExpiryDate] = React.useState(initial?.expiryDate ?? "");
  const [openedDate, setOpenedDate] = React.useState(initial?.openedDate ?? "");
  const [notes, setNotes] = React.useState(initial?.notes ?? "");
  const [pending, startTransition] = React.useTransition();

  function submit() {
    const input = {
      ingredientId,
      name: null,
      quantity,
      unit,
      locationId: location.id,
      locationName: location.id == null ? location.name : null,
      expiryDate,
      openedDate,
      notes,
    };
    startTransition(async () => {
      const res = isEdit
        ? await updateInventoryItemAction(initial!.id, input)
        : await createInventoryItemAction(input);
      if (res.ok) {
        toast.success(isEdit ? "Updated" : "Added to inventory");
        onDone();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className={showLocation ? "grid grid-cols-3 gap-3" : "grid grid-cols-2 gap-3"}>
        <div className="grid gap-1">
          <Label htmlFor="qty" className="text-xs">Quantity</Label>
          <Input id="qty" type="number" min={0} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="unit" className="text-xs">Unit</Label>
          <select id="unit" className={selectClass} value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="">unit…</option>
            {UNIT_OPTIONS.map((u) => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
        </div>
        {showLocation && (
          <div className="grid gap-1">
            <Label className="text-xs">Location</Label>
            <LocationCombobox options={locations} value={location} onChange={setLocation} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1">
          <Label htmlFor="expiry" className="text-xs">Expiry date</Label>
          <Input id="expiry" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="opened" className="text-xs">Opened date</Label>
          <Input id="opened" type="date" value={openedDate} onChange={(e) => setOpenedDate(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-1">
        <Label htmlFor="notes" className="text-xs">Notes</Label>
        <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" />
      </div>

      <FormActions>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button size="sm" onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </FormActions>
    </div>
  );
}

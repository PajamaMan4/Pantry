"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IngredientPicker } from "@/components/ingredient-picker";
import { LocationCombobox, type LocationOption } from "@/components/location-combobox";
import type { IngredientOption } from "@/components/ingredient-combobox";
import { UNIT_OPTIONS } from "@/lib/domain/units";
import { addInventoryBulkAction } from "@/app/ingredients/actions";
import { cn } from "@/lib/utils";

const selectClass = "h-8 rounded-md border border-input bg-transparent px-2 text-sm";

const INITIAL_ROWS = 3;

type Row = {
  key: string;
  ingredientId: number | null;
  ingredientName: string;
  amount: string;
  amountUnit: string;
  location: { id: number | null; name: string };
  cost: string;
};

function emptyRow(): Row {
  return {
    key: nanoid(),
    ingredientId: null,
    ingredientName: "",
    amount: "",
    amountUnit: "",
    location: { id: null, name: "" },
    cost: "",
  };
}

export function AddInventoryForm({
  allIngredients,
  locations,
  showLocations = true,
}: {
  allIngredients: IngredientOption[];
  locations: LocationOption[];
  showLocations?: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = React.useState<Row[]>(() =>
    Array.from({ length: INITIAL_ROWS }, emptyRow),
  );
  const [pending, startTransition] = React.useTransition();

  function patchRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }
  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  function submit() {
    const active = rows.filter((r) => {
      const hasName = r.ingredientName.trim().length > 0;
      const hasAmount = r.amount.trim() !== "";
      const hasCost = r.cost.trim() !== "";
      return hasName || hasAmount || hasCost;
    });

    // A cost is the total paid for the amount added, so it needs an amount to
    // divide by; an amount needs a unit to be meaningful.
    for (const r of active) {
      if (r.cost.trim() !== "" && r.amount.trim() === "") {
        toast.error(`Enter an amount for the cost you paid on "${r.ingredientName.trim() || "item"}".`);
        return;
      }
      if (r.amount.trim() !== "" && !r.amountUnit) {
        toast.error(`Pick a unit for "${r.ingredientName.trim() || "item"}".`);
        return;
      }
    }

    const items = active
      .filter((r) => r.ingredientName.trim().length > 0 && r.amount.trim() !== "")
      .map((r) => ({
        name: r.ingredientName.trim(),
        addQuantity: Number(r.amount),
        addUnit: r.amountUnit || null,
        location: r.location.name.trim() || null,
        cost: r.cost.trim() === "" ? null : Number(r.cost),
        costUnit: r.cost.trim() === "" ? null : r.amountUnit || null,
        costQuantity: r.cost.trim() === "" ? null : Number(r.amount),
      }));

    if (items.length === 0) {
      toast.error("Add at least one item with an amount.");
      return;
    }

    startTransition(async () => {
      const res = await addInventoryBulkAction(items);
      if (res.ok) {
        toast.success(`Added ${items.length} item${items.length === 1 ? "" : "s"} to inventory`);
        router.push("/ingredients");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* Column headers (md+) */}
      <div
        className={cn(
          "hidden gap-2 px-1 text-xs text-muted-foreground md:grid",
          showLocations
            ? "md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto]"
            : "md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]",
        )}
      >
        <span>Ingredient</span>
        <span>Amount</span>
        <span>Unit</span>
        {showLocations && <span>Location</span>}
        <span>Cost paid</span>
        <span className="w-7" />
      </div>

      <div className="space-y-3 md:space-y-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className={cn(
              "grid grid-cols-2 gap-2 rounded-lg border p-3 md:items-center md:rounded-none md:border-0 md:p-0",
              showLocations
                ? "md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto]"
                : "md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]",
            )}
          >
            <div className="col-span-2 md:col-span-1">
              <Label className="text-xs md:hidden">Ingredient</Label>
              <IngredientPicker
                initialOptions={allIngredients}
                selectedName={row.ingredientName}
                placeholder="Search or add…"
                onType={(name) => patchRow(row.key, { ingredientId: null, ingredientName: name })}
                onPick={(picked) =>
                  patchRow(row.key, {
                    ingredientId: picked.id,
                    ingredientName: picked.name,
                    amountUnit: row.amountUnit || picked.defaultUnit || "",
                    location: row.location.name.trim()
                      ? row.location
                      : { id: picked.defaultLocationId ?? null, name: picked.defaultLocationName ?? "" },
                  })
                }
              />
            </div>

            <div>
              <Label className="text-xs md:hidden">Amount</Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={row.amount}
                onChange={(e) => patchRow(row.key, { amount: e.target.value })}
              />
            </div>

            <div>
              <Label className="text-xs md:hidden">Unit</Label>
              <select
                className={`${selectClass} w-full`}
                value={row.amountUnit}
                onChange={(e) => patchRow(row.key, { amountUnit: e.target.value })}
              >
                <option value="">unit…</option>
                {UNIT_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>

            {showLocations && (
              <div>
                <Label className="text-xs md:hidden">Location</Label>
                <LocationCombobox
                  options={locations}
                  value={row.location}
                  onChange={(v) => patchRow(row.key, { location: v })}
                />
              </div>
            )}

            <div>
              <Label className="text-xs md:hidden">Cost paid</Label>
              <Input
                type="number"
                min={0}
                step="any"
                placeholder="total paid"
                value={row.cost}
                onChange={(e) => patchRow(row.key, { cost: e.target.value })}
              />
            </div>

            <div className="col-span-2 flex justify-end md:col-span-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove row"
                onClick={() => removeRow(row.key)}
                disabled={rows.length <= 1}
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background px-4 py-3">
        <FormActions
          extra={
            <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={pending}>
              <PlusIcon className="size-4" /> Add row
            </Button>
          }
        >
          <Button type="button" variant="outline" onClick={() => router.push("/ingredients")} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Add to inventory"}
          </Button>
        </FormActions>
      </div>
    </div>
  );
}

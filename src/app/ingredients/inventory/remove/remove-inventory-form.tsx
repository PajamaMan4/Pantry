"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { PlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IngredientCombobox, type IngredientOption } from "@/components/ingredient-combobox";
import { removeInventoryBulkAction } from "@/app/ingredients/actions";

export type StockEntry = {
  inventoryItemId: number;
  locationName: string;
  unit: string;
  label: string;
};

export type InStockIngredient = {
  id: number;
  name: string;
  defaultUnit: string | null;
  stock: StockEntry[];
};

const selectClass = "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm";

const INITIAL_ROWS = 3;

type Row = {
  key: string;
  ingredientId: number | null;
  ingredientName: string;
  inventoryItemId: number | null;
  amount: string;
};

function emptyRow(): Row {
  return { key: nanoid(), ingredientId: null, ingredientName: "", inventoryItemId: null, amount: "" };
}

export function RemoveInventoryForm({
  inStock,
  options,
}: {
  inStock: InStockIngredient[];
  options: IngredientOption[];
}) {
  const router = useRouter();
  const stockById = React.useMemo(() => new Map(inStock.map((i) => [i.id, i])), [inStock]);
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

  function pickIngredient(key: string, id: number | null, name: string) {
    // Auto-select the only stock entry so single-location items are one click.
    const stock = id != null ? stockById.get(id)?.stock ?? [] : [];
    patchRow(key, {
      ingredientId: id,
      ingredientName: name,
      inventoryItemId: stock.length === 1 ? stock[0].inventoryItemId : null,
    });
  }

  function submit() {
    const lines = rows
      .filter((r) => r.inventoryItemId != null && r.amount.trim() !== "" && Number(r.amount) > 0)
      .map((r) => ({ inventoryItemId: r.inventoryItemId as number, amount: Number(r.amount) }));

    if (lines.length === 0) {
      toast.error("Pick a stock entry and an amount for at least one row.");
      return;
    }

    startTransition(async () => {
      const res = await removeInventoryBulkAction(lines);
      if (res.ok) {
        toast.success(`Removed ${lines.length} item${lines.length === 1 ? "" : "s"} from inventory`);
        router.push("/ingredients");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {rows.map((row) => {
          const stock = row.ingredientId != null ? stockById.get(row.ingredientId)?.stock ?? [] : [];
          const selected = stock.find((s) => s.inventoryItemId === row.inventoryItemId);
          return (
            <div key={row.key} className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
              <div className="grid gap-1">
                <Label className="text-xs">Ingredient</Label>
                <IngredientCombobox
                  options={options}
                  selectedName={row.ingredientName}
                  placeholder="Search in stock…"
                  allowCreate={false}
                  onType={(name) => patchRow(row.key, { ingredientId: null, ingredientName: name, inventoryItemId: null })}
                  onSelect={(opt) => pickIngredient(row.key, opt.id, opt.name)}
                  onCreate={async () => {}}
                />
              </div>

              <div className="grid gap-1">
                <Label className="text-xs">Stock entry</Label>
                <select
                  className={selectClass}
                  value={row.inventoryItemId ?? ""}
                  disabled={row.ingredientId == null}
                  onChange={(e) =>
                    patchRow(row.key, {
                      inventoryItemId: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                >
                  <option value="">{row.ingredientId == null ? "pick ingredient first" : "select…"}</option>
                  {stock.map((s) => (
                    <option key={s.inventoryItemId} value={s.inventoryItemId}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1">
                <Label className="text-xs">Amount{selected ? ` (${selected.unit})` : ""}</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={row.amount}
                  onChange={(e) => patchRow(row.key, { amount: e.target.value })}
                />
              </div>

              <div className="flex justify-end">
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
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={pending}>
          <PlusIcon className="size-4" /> Add row
        </Button>
        <div className="grow" />
        <Button type="button" variant="ghost" onClick={() => router.push("/ingredients")} disabled={pending}>
          Cancel
        </Button>
        <Button type="button" onClick={submit} disabled={pending}>
          {pending ? "Removing…" : "Remove from inventory"}
        </Button>
      </div>
    </div>
  );
}

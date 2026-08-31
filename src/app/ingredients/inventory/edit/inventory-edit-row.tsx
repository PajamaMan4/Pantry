"use client";

import { RotateCcwIcon, ShelvingUnitIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IngredientPicker } from "@/components/ingredient-picker";
import type { IngredientOption } from "@/components/ingredient-combobox";
import { UNIT_OPTIONS } from "@/lib/domain/units";
import type { DraftLine } from "@/lib/domain/inventory-edit";
import { cn } from "@/lib/utils";

/**
 * Fields either line kind can be patched with. Deliberately hand-written rather
 * than `Partial<ExistingLine> & Partial<NewLine>` — that intersection collapses
 * `ingredientId` to `number` (existing has no `null`), which rejects the `null`
 * a fresh IngredientPicker patch needs to send.
 */
export type LinePatch = Partial<{
  amount: string;
  unit: string;
  locationId: number | null;
  deleted: boolean;
  ingredientId: number | null;
  ingredientName: string;
}>;

const selectClass = "h-8 rounded-md border border-input bg-transparent px-2 text-sm";

// Ingredient is fixed rather than fr-sized: the row should hug its content
// instead of stretching to the container. Unit is sized to "each / count",
// the longest UNIT_OPTIONS label. These same widths are reused below md (on
// the Amount input and Unit select directly) so a phone-width row wraps to
// just two lines — name, then amount/unit/actions — instead of stretching
// Amount and Unit to half the card each.
const colsTemplate = "md:grid-cols-[12rem_5rem_7.5rem_auto]";

const rowGrid = `flex flex-wrap items-center gap-2 rounded-lg border p-3 md:grid ${colsTemplate} md:rounded-none md:border-0 md:p-0`;

export function InventoryEditRowHeader() {
  return (
    <div className={`hidden gap-2 px-1 text-xs text-muted-foreground md:grid ${colsTemplate}`}>
      <span>Ingredient</span>
      <span>Amount</span>
      <span>Unit</span>
      <span className="w-16" />
    </div>
  );
}

export function InventoryEditRow({
  line,
  invalid,
  merging,
  allIngredients,
  onPatch,
  onRemove,
  onRestore,
  onPick,
  onMove,
  showLocation = true,
}: {
  line: DraftLine;
  invalid: boolean;
  merging: boolean;
  allIngredients: IngredientOption[];
  onPatch: (patch: LinePatch) => void;
  onRemove: () => void;
  onRestore: () => void;
  onPick: (picked: { id: number | null; name: string; defaultUnit: string | null }) => void;
  onMove: () => void;
  showLocation?: boolean;
}) {
  const deleted = line.kind === "existing" && line.deleted;
  const name = line.ingredientName;

  return (
    <div className="space-y-1">
      <div
        className={cn(rowGrid, invalid && "ring-1 ring-destructive", deleted && "opacity-50")}
      >
        <div className="w-full md:w-auto">
          <Label className="text-xs md:hidden">Ingredient</Label>
          {line.kind === "existing" ? (
            <div className="flex h-8 items-center text-sm">
              <span className={cn(deleted && "line-through")}>{line.ingredientName}</span>
            </div>
          ) : (
            <IngredientPicker
              initialOptions={allIngredients}
              selectedName={line.ingredientName}
              placeholder="Search or add…"
              onType={(typedName) => onPatch({ ingredientId: null, ingredientName: typedName })}
              onPick={onPick}
            />
          )}
        </div>

        <Input
          type="number"
          min={0}
          step="any"
          disabled={deleted}
          value={line.amount}
          onChange={(e) => onPatch({ amount: e.target.value })}
          aria-label="Amount"
          className="w-20 px-2 tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
        />

        <select
          className={`${selectClass} w-[7.5rem]`}
          disabled={deleted}
          value={line.unit}
          onChange={(e) => onPatch({ unit: e.target.value })}
          aria-label="Unit"
        >
          {line.kind === "new" && <option value="">unit…</option>}
          {UNIT_OPTIONS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>

        <div className="ml-auto flex gap-1 md:ml-0">
          {!deleted && showLocation && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Move ${name || "entry"} to another location`}
              onClick={onMove}
            >
              <ShelvingUnitIcon className="size-4" />
            </Button>
          )}
          {deleted ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Undo removing ${name}`}
              onClick={onRestore}
            >
              <RotateCcwIcon className="size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${name || "entry"}`}
              onClick={onRemove}
            >
              <TrashIcon className="size-4" />
            </Button>
          )}
        </div>
      </div>
      {merging && !deleted && (
        <p className="px-1 text-xs text-muted-foreground">merges with an existing line on save</p>
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import { TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { UNIT_OPTIONS } from "@/lib/domain/units";
import { toggleShoppingItemAction, updateShoppingItemAction, deleteShoppingItemAction } from "./actions";

export type SerialShoppingItem = {
  id: number;
  ingredientId: number | null;
  name: string;
  quantity: string;
  unit: string;
  price: string;
  checked: boolean;
};

const selectClass = "h-8 rounded-md border border-input bg-transparent px-1.5 text-xs";

export function ShoppingItemRow({ item, currency }: { item: SerialShoppingItem; currency: string }) {
  const [checked, setChecked] = React.useState(item.checked);
  const [quantity, setQuantity] = React.useState(item.quantity);
  const [unit, setUnit] = React.useState(item.unit);
  const [price, setPrice] = React.useState(item.price);
  const [, startTransition] = React.useTransition();

  function save(next?: { quantity?: string; unit?: string; price?: string }) {
    const q = next?.quantity ?? quantity;
    const u = next?.unit ?? unit;
    const p = next?.price ?? price;
    startTransition(async () => {
      await updateShoppingItemAction(item.id, {
        ingredientId: item.ingredientId,
        name: item.name,
        quantity: q,
        unit: u,
        price: p,
      });
    });
  }

  function toggle(value: boolean) {
    setChecked(value);
    startTransition(async () => {
      await toggleShoppingItemAction(item.id, value);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <Checkbox checked={checked} onCheckedChange={(v) => toggle(v === true)} aria-label={`Bought ${item.name}`} />
      <span className={cn("min-w-32 flex-1 text-sm", checked && "text-muted-foreground line-through")}>
        {item.ingredientId ? (
          <a href={`/ingredients/${item.ingredientId}`} className="hover:underline">
            {item.name}
          </a>
        ) : (
          item.name
        )}
      </span>
      <Input
        type="number"
        min={0}
        step="any"
        className="h-8 w-16"
        placeholder="qty"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        onBlur={() => save()}
      />
      <select
        className={selectClass}
        value={unit}
        onChange={(e) => {
          setUnit(e.target.value);
          save({ unit: e.target.value });
        }}
        aria-label="Unit"
      >
        <option value="">unit…</option>
        {UNIT_OPTIONS.map((u) => (
          <option key={u.value} value={u.value}>{u.label}</option>
        ))}
      </select>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">{currency}</span>
        <Input
          type="number"
          min={0}
          step="0.01"
          className="h-8 w-20"
          placeholder="price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={() => save()}
        />
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Remove ${item.name}`}
        onClick={() => startTransition(async () => void (await deleteShoppingItemAction(item.id)))}
      >
        <TrashIcon className="size-4" />
      </Button>
    </div>
  );
}

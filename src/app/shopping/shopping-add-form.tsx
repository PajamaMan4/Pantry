"use client";

import * as React from "react";
import { toast } from "sonner";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IngredientPicker } from "@/components/ingredient-picker";
import type { IngredientOption } from "@/components/ingredient-combobox";
import { UNIT_OPTIONS } from "@/lib/domain/units";
import { addShoppingItemAction } from "./actions";

const selectClass = "h-9 rounded-md border border-input bg-transparent px-2 text-sm";

export function ShoppingAddForm({ ingredientOptions }: { ingredientOptions: IngredientOption[] }) {
  const [ingredientId, setIngredientId] = React.useState<number | null>(null);
  const [name, setName] = React.useState("");
  const [quantity, setQuantity] = React.useState("");
  const [unit, setUnit] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function add() {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await addShoppingItemAction({ ingredientId, name, quantity, unit, price: "" });
      if (res.ok) {
        setIngredientId(null);
        setName("");
        setQuantity("");
        setUnit("");
        toast.success("Added");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
      <div className="min-w-48 flex-1">
        <IngredientPicker
          initialOptions={ingredientOptions}
          selectedName={name}
          placeholder="Add an item…"
          onType={(n) => {
            setName(n);
            setIngredientId(null);
          }}
          onPick={(p) => {
            setIngredientId(p.id);
            setName(p.name);
            if (!unit && p.defaultUnit) setUnit(p.defaultUnit);
          }}
        />
      </div>
      <Input type="number" min={0} step="any" className="w-20" placeholder="qty" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
      <select className={selectClass} value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Unit">
        <option value="">unit…</option>
        {UNIT_OPTIONS.map((u) => (
          <option key={u.value} value={u.value}>{u.label}</option>
        ))}
      </select>
      <Button onClick={add} disabled={pending || !name.trim()}>
        <PlusIcon className="size-4" /> Add
      </Button>
    </div>
  );
}

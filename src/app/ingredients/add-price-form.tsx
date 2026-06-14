"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UNIT_OPTIONS } from "@/lib/domain/units";
import { addPriceAction } from "./actions";

const selectClass = "h-9 rounded-md border border-input bg-transparent px-2 text-sm";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AddPriceForm({
  ingredientId,
  defaultUnit,
}: {
  ingredientId: number;
  defaultUnit: string | null;
}) {
  const [price, setPrice] = React.useState("");
  const [quantity, setQuantity] = React.useState("");
  const [unit, setUnit] = React.useState(defaultUnit ?? "");
  const [store, setStore] = React.useState("");
  const [purchasedAt, setPurchasedAt] = React.useState(todayStr());
  const [pending, startTransition] = React.useTransition();

  function add() {
    startTransition(async () => {
      const res = await addPriceAction(ingredientId, { price, quantity, unit, store, purchasedAt });
      if (res.ok) {
        toast.success("Price added");
        setPrice("");
        setQuantity("");
        setStore("");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="grid gap-1">
        <Label htmlFor="price" className="text-xs">
          Price
        </Label>
        <Input id="price" type="number" min={0} step="0.01" className="w-24" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <span className="pb-2 text-sm text-muted-foreground">for</span>
      <div className="grid gap-1">
        <Label htmlFor="quantity" className="text-xs">
          Qty
        </Label>
        <Input id="quantity" type="number" min={0} step="any" className="w-20" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="unit" className="text-xs">
          Unit
        </Label>
        <select id="unit" className={selectClass} value={unit} onChange={(e) => setUnit(e.target.value)}>
          <option value="">unit…</option>
          {UNIT_OPTIONS.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="store" className="text-xs">
          Store
        </Label>
        <Input id="store" className="w-32" value={store} onChange={(e) => setStore(e.target.value)} placeholder="optional" />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="purchasedAt" className="text-xs">
          Date
        </Label>
        <Input id="purchasedAt" type="date" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} />
      </div>
      <Button onClick={add} disabled={pending} size="sm">
        {pending ? "Adding…" : "Add price"}
      </Button>
    </div>
  );
}

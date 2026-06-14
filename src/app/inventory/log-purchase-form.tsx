"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IngredientPicker } from "@/components/ingredient-picker";
import type { IngredientOption } from "@/components/ingredient-combobox";
import { UNIT_OPTIONS } from "@/lib/domain/units";
import { logPurchaseAction } from "./actions";

type LocationOption = { id: number; name: string };

const selectClass = "h-9 rounded-md border border-input bg-transparent px-2 text-sm";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function LogPurchaseForm({
  ingredientOptions,
  locations,
}: {
  ingredientOptions: IngredientOption[];
  locations: LocationOption[];
}) {
  const router = useRouter();

  const [ingredientId, setIngredientId] = React.useState<number | null>(null);
  const [ingredientName, setIngredientName] = React.useState("");
  const [quantity, setQuantity] = React.useState("");
  const [unit, setUnit] = React.useState("");
  const [locationId, setLocationId] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [store, setStore] = React.useState("");
  const [purchasedAt, setPurchasedAt] = React.useState(todayStr());
  const [expiryDate, setExpiryDate] = React.useState("");

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
      price,
      store,
      purchasedAt,
      expiryDate,
    };
    startTransition(async () => {
      const res = await logPurchaseAction(input);
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
          placeholder="What did you buy?"
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

      <div className="grid grid-cols-3 gap-4">
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
        <div className="grid gap-2">
          <Label htmlFor="price">Price paid</Label>
          <Input id="price" type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
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
        <div className="grid gap-2">
          <Label htmlFor="store">Store</Label>
          <Input id="store" value={store} onChange={(e) => setStore(e.target.value)} placeholder="optional" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="purchasedAt">Purchased on</Label>
          <Input id="purchasedAt" type="date" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="expiry">Expiry date</Label>
          <Input id="expiry" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Saving adds this to your inventory <strong>and</strong> records the price.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Log purchase"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { toast } from "sonner";
import { DollarSignIcon, ShoppingCartIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { LocationCombobox, type LocationOption } from "@/components/location-combobox";
import { UNIT_OPTIONS } from "@/lib/domain/units";
import { addPriceAction, logPurchaseAction } from "./actions";

const selectClass = "h-9 rounded-md border border-input bg-transparent px-2 text-sm";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Mode = "price" | "purchase" | null;

export function PriceForms({
  ingredientId,
  defaultUnit,
  locations,
}: {
  ingredientId: number;
  defaultUnit: string | null;
  locations: LocationOption[];
}) {
  const [mode, setMode] = React.useState<Mode>(null);

  const toggle = (m: "price" | "purchase") => setMode((cur) => (cur === m ? null : m));

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          aria-expanded={mode === "price"}
          className={cn(mode === "price" && "bg-muted")}
          onClick={() => toggle("price")}
        >
          <DollarSignIcon className="size-4" /> Add price
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-expanded={mode === "purchase"}
          className={cn(mode === "purchase" && "bg-muted")}
          onClick={() => toggle("purchase")}
        >
          <ShoppingCartIcon className="size-4" /> Log purchase
        </Button>
      </div>

      <Collapsible open={mode === "price"} onOpenChange={(o) => !o && setMode(null)}>
        <CollapsibleContent>
          <AddPriceFields
            ingredientId={ingredientId}
            defaultUnit={defaultUnit}
            onDone={() => setMode(null)}
            onCancel={() => setMode(null)}
          />
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={mode === "purchase"} onOpenChange={(o) => !o && setMode(null)}>
        <CollapsibleContent>
          <LogPurchaseFields
            ingredientId={ingredientId}
            defaultUnit={defaultUnit}
            locations={locations}
            onDone={() => setMode(null)}
            onCancel={() => setMode(null)}
          />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function AddPriceFields({
  ingredientId,
  defaultUnit,
  onDone,
  onCancel,
}: {
  ingredientId: number;
  defaultUnit: string | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [price, setPrice] = React.useState("");
  const [quantity, setQuantity] = React.useState("");
  const [unit, setUnit] = React.useState(defaultUnit ?? "");
  const [store, setStore] = React.useState("");
  const [purchasedAt, setPurchasedAt] = React.useState(todayStr());
  const [pending, startTransition] = React.useTransition();

  function save() {
    startTransition(async () => {
      const res = await addPriceAction(ingredientId, { price, quantity, unit, store, purchasedAt });
      if (res.ok) {
        toast.success("Price added");
        onDone();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-muted/30 p-3">
      <Field label="Price"><Input className="w-24" type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
      <span className="pb-2 text-sm text-muted-foreground">for</span>
      <Field label="Qty"><Input className="w-20" type="number" min={0} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field>
      <Field label="Unit">
        <select className={selectClass} value={unit} onChange={(e) => setUnit(e.target.value)}>
          <option value="">unit…</option>
          {UNIT_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
        </select>
      </Field>
      <Field label="Store"><Input className="w-28" value={store} onChange={(e) => setStore(e.target.value)} placeholder="optional" /></Field>
      <Field label="Date"><Input type="date" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} /></Field>
      <Button size="sm" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
      <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>
    </div>
  );
}

function LogPurchaseFields({
  ingredientId,
  defaultUnit,
  locations,
  onDone,
  onCancel,
}: {
  ingredientId: number;
  defaultUnit: string | null;
  locations: LocationOption[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [quantity, setQuantity] = React.useState("");
  const [unit, setUnit] = React.useState(defaultUnit ?? "");
  const [location, setLocation] = React.useState<{ id: number | null; name: string }>({ id: null, name: "" });
  const [price, setPrice] = React.useState("");
  const [store, setStore] = React.useState("");
  const [purchasedAt, setPurchasedAt] = React.useState(todayStr());
  const [expiryDate, setExpiryDate] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function save() {
    const input = {
      ingredientId,
      name: null,
      quantity,
      unit,
      locationId: location.id,
      locationName: location.id == null ? location.name : null,
      price,
      store,
      purchasedAt,
      expiryDate,
    };
    startTransition(async () => {
      const res = await logPurchaseAction(input);
      if (res.ok) {
        toast.success("Purchase logged");
        onDone();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Quantity"><Input type="number" min={0} step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field>
        <Field label="Unit">
          <select className={selectClass} value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="">unit…</option>
            {UNIT_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </Field>
        <Field label="Price paid"><Input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Location"><LocationCombobox options={locations} value={location} onChange={setLocation} /></Field>
        <Field label="Store"><Input value={store} onChange={(e) => setStore(e.target.value)} placeholder="optional" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Purchased on"><Input type="date" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} /></Field>
        <Field label="Expiry date"><Input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /></Field>
      </div>
      <p className="text-xs text-muted-foreground">Adds to inventory and records the price.</p>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

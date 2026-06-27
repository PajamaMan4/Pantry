import type { Metadata } from "next";
import Link from "next/link";
import { listInventory } from "@/lib/db/inventory";
import { displayQuantity } from "@/lib/domain/scaling";
import type { IngredientOption } from "@/components/ingredient-combobox";
import { RemoveInventoryForm, type InStockIngredient } from "./remove-inventory-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Remove inventory · Pantry" };

export default function RemoveInventoryPage() {
  // Build the in-stock list grouped by ingredient. Each stock entry targets an
  // exact inventory row, so removal happens in that row's own (stored) unit —
  // we render labels in "original" mode so the displayed unit matches storage.
  const byIngredient = new Map<number, InStockIngredient>();
  for (const r of listInventory()) {
    const ing = r.ingredient;
    const entry = byIngredient.get(ing.id) ?? {
      id: ing.id,
      name: ing.name,
      defaultUnit: ing.defaultUnit,
      stock: [],
    };
    const qty = displayQuantity(
      { amount: r.item.quantity, amountMax: null, unit: r.item.unit, raw: null },
      { factor: 1, system: "original", rounding: "exact" },
    );
    const locationName = r.location?.name ?? "Unsorted";
    entry.stock.push({
      inventoryItemId: r.item.id,
      locationName,
      unit: r.item.unit,
      label: `${locationName} — ${qty}`,
    });
    byIngredient.set(ing.id, entry);
  }

  const inStock = [...byIngredient.values()].sort((a, b) => a.name.localeCompare(b.name));
  const options: IngredientOption[] = inStock.map((i) => ({
    id: i.id,
    name: i.name,
    defaultUnit: i.defaultUnit,
  }));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link href="/ingredients" className="text-sm text-muted-foreground hover:text-foreground">
        ← Ingredients
      </Link>
      <h1 className="mt-3 mb-1 text-2xl font-semibold tracking-tight">Remove inventory</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Draw down stock you&apos;ve used up. Pick an in-stock ingredient, choose which stock entry to
        remove from, and enter the amount (in that entry&apos;s unit). Removing the full amount clears
        the entry.
      </p>
      {inStock.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nothing in stock yet.
        </p>
      ) : (
        <RemoveInventoryForm inStock={inStock} options={options} />
      )}
    </div>
  );
}

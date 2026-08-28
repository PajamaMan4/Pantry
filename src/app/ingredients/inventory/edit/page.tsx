import type { Metadata } from "next";
import { listIngredients } from "@/lib/db/ingredients";
import { listLocations } from "@/lib/db/locations";
import { listInventory } from "@/lib/db/inventory";
import type { IngredientOption } from "@/components/ingredient-combobox";
import type { LocationOption } from "@/components/location-combobox";
import type { InventoryEditSeed } from "@/lib/domain/inventory-edit";
import { InventoryEditor } from "./inventory-editor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit inventory · Pantry" };

export default function InventoryEditPage() {
  const seeds: InventoryEditSeed[] = listInventory().map((r) => ({
    id: r.item.id,
    ingredientId: r.ingredient.id,
    ingredientName: r.ingredient.name,
    quantity: r.item.quantity,
    unit: r.item.unit,
    locationId: r.item.locationId,
  }));
  const locations: LocationOption[] = listLocations().map((l) => ({ id: l.id, name: l.name }));
  const allIngredients: IngredientOption[] = listIngredients().map((i) => ({
    id: i.id,
    name: i.name,
    defaultUnit: i.defaultUnit,
  }));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      {/* No "← Ingredients" link here on purpose: it's a silent data-loss path
          that bypasses the discard-changes dialog. Cancel is the only exit. */}
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Edit inventory</h1>
      <InventoryEditor seeds={seeds} locations={locations} allIngredients={allIngredients} />
    </div>
  );
}

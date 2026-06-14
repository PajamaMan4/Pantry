import type { Metadata } from "next";
import { listIngredients } from "@/lib/db/ingredients";
import { listLocations } from "@/lib/db/locations";
import { InventoryItemForm } from "../inventory-item-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add inventory item · Pantry" };

export default function NewInventoryItemPage() {
  const ingredients = listIngredients();
  const locations = listLocations();

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Add to inventory</h1>
      <InventoryItemForm
        ingredientOptions={ingredients.map((i) => ({ id: i.id, name: i.name, defaultUnit: i.defaultUnit }))}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
      />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { listIngredients } from "@/lib/db/ingredients";
import { listLocations } from "@/lib/db/locations";
import { getSettings } from "@/lib/db/settings";
import type { IngredientOption } from "@/components/ingredient-combobox";
import type { LocationOption } from "@/components/location-combobox";
import { AddInventoryForm } from "./add-inventory-form";
import { PageHelpMenu } from "@/components/help/page-help-menu";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add inventory · Pantry" };

export default function AddInventoryPage() {
  const { showLocations } = getSettings();
  const locations: LocationOption[] = listLocations().map((l) => ({ id: l.id, name: l.name }));
  const locationNameById = new Map(locations.map((l) => [l.id, l.name]));
  const allIngredients: IngredientOption[] = listIngredients().map((i) => ({
    id: i.id,
    name: i.name,
    defaultUnit: i.defaultUnit,
    defaultLocationId: i.defaultLocationId,
    defaultLocationName: i.defaultLocationId != null ? (locationNameById.get(i.defaultLocationId) ?? null) : null,
  }));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <Link href="/ingredients" className="text-sm text-muted-foreground hover:text-foreground">
          ← Ingredients
        </Link>
        <PageHelpMenu topicId="inventory-add" />
      </div>
      <h1 className="mt-3 mb-1 text-2xl font-semibold tracking-tight">Add inventory</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Add several items to your inventory at once. Each line can record stock (amount + unit +
        location) and/or a price (cost per cost-unit). Blank lines are ignored.
      </p>
      <AddInventoryForm allIngredients={allIngredients} locations={locations} showLocations={showLocations} />
    </div>
  );
}

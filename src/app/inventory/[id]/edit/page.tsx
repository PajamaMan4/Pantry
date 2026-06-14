import { notFound } from "next/navigation";
import { listIngredients } from "@/lib/db/ingredients";
import { listLocations } from "@/lib/db/locations";
import { getInventoryItem } from "@/lib/db/inventory";
import { InventoryItemForm, type InventoryItemInitial } from "../../inventory-item-form";

export const dynamic = "force-dynamic";

function toDateInput(d: Date | null): string {
  if (!d) return "";
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export default async function EditInventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId)) notFound();

  const row = getInventoryItem(itemId);
  if (!row) notFound();

  const ingredients = listIngredients();
  const locations = listLocations();

  const initial: InventoryItemInitial = {
    id: row.item.id,
    ingredientId: row.ingredient.id,
    ingredientName: row.ingredient.name,
    quantity: String(row.item.quantity),
    unit: row.item.unit,
    locationId: row.location ? String(row.location.id) : "",
    expiryDate: toDateInput(row.item.expiryDate),
    openedDate: toDateInput(row.item.openedDate),
    notes: row.item.notes ?? "",
  };

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Edit inventory item</h1>
      <InventoryItemForm
        initial={initial}
        ingredientOptions={ingredients.map((i) => ({ id: i.id, name: i.name, defaultUnit: i.defaultUnit }))}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
      />
    </div>
  );
}

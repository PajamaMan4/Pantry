import type { Metadata } from "next";
import { listShoppingItems } from "@/lib/db/shopping";
import { listIngredients } from "@/lib/db/ingredients";
import { getSettings } from "@/lib/db/settings";
import { ShoppingAddForm } from "./shopping-add-form";
import { ShoppingItemRow, type SerialShoppingItem } from "./shopping-item-row";
import { ShoppingBar } from "./shopping-bar";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shopping list · Pantry" };

const str = (n: number | null) => (n == null ? "" : String(n));

export default function ShoppingPage() {
  const items = listShoppingItems();
  const ingredients = listIngredients();
  const { currency } = getSettings();
  const checkedCount = items.filter((i) => i.checked).length;

  const serial: SerialShoppingItem[] = items.map((i) => ({
    id: i.id,
    ingredientId: i.ingredientId,
    name: i.name,
    quantity: str(i.quantity),
    unit: i.unit ?? "",
    price: str(i.price),
    checked: i.checked,
  }));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Shopping list</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Check items off as you shop, fill in the price you paid, then add what you bought straight to
        your inventory.
      </p>

      <div className="mb-4">
        <ShoppingAddForm
          ingredientOptions={ingredients.map((i) => ({ id: i.id, name: i.name, defaultUnit: i.defaultUnit }))}
        />
      </div>

      {serial.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Your list is empty. Add items above, or use “add missing to list” from{" "}
          <a href="/make" className="text-primary underline-offset-4 hover:underline">What can I make?</a>.
        </p>
      ) : (
        <>
          <div className="mb-4">
            <ShoppingBar checkedCount={checkedCount} />
          </div>
          <div className="divide-y rounded-lg border px-3">
            {serial.map((item) => (
              <ShoppingItemRow key={item.id} item={item} currency={currency} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

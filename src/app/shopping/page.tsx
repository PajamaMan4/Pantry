import type { Metadata } from "next";
import { listShoppingItems, type ShoppingListRow } from "@/lib/db/shopping";
import { listIngredientsWithAliases } from "@/lib/db/ingredients";
import { getSettings } from "@/lib/db/settings";
import { groupByLocation } from "@/lib/domain/location-groups";
import { groupByCategory } from "@/lib/domain/category-groups";
import { Badge } from "@/components/ui/badge";
import { ListGroupingToggle } from "@/components/list-grouping-toggle";
import { ShoppingAddForm } from "./shopping-add-form";
import { ShoppingItemRow, type SerialShoppingItem } from "./shopping-item-row";
import { ShoppingBar } from "./shopping-bar";
import { ImportInventoryDialog } from "./import-inventory-dialog";
import { PageHelpMenu } from "@/components/help/page-help-menu";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shopping list · Pantry" };

const str = (n: number | null) => (n == null ? "" : String(n));

const toSerial = (i: ShoppingListRow): SerialShoppingItem => ({
  id: i.id,
  ingredientId: i.ingredientId,
  name: i.name,
  quantity: str(i.quantity),
  unit: i.unit ?? "",
  price: str(i.price),
  checked: i.checked,
});

export default function ShoppingPage() {
  const items = listShoppingItems();
  const ingredients = listIngredientsWithAliases();
  const { currency, listGrouping, showLocations } = getSettings();
  const grouping = listGrouping === "none" ? "none" : "grouped";
  const checkedCount = items.filter((i) => i.checked).length;

  // Rows already arrive sorted unchecked-before-checked (listShoppingItems'
  // orderBy), so each group inherits that order too — a checked item sinks to
  // the bottom of its own group for free, with no extra sort here.
  const serial: SerialShoppingItem[] = items.map(toSerial);
  const groups =
    grouping === "grouped"
      ? (showLocations ? groupByLocation(items, (i) => i.location) : groupByCategory(items, (i) => i.category)).map(
          (g) => ({ ...g, serial: g.items.map(toSerial) }),
        )
      : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Shopping list</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Check items off as you shop, fill in the price you paid, then add what you bought straight to
            your inventory.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ImportInventoryDialog />
          <PageHelpMenu topicId="shopping" />
        </div>
      </div>

      <div className="mb-4">
        <ShoppingAddForm
          ingredientOptions={ingredients.map((i) => ({ id: i.id, name: i.name, defaultUnit: i.defaultUnit, aliases: i.aliases }))}
        />
      </div>

      {serial.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Your list is empty. Add items above, or use “add missing to list” from{" "}
          <a href="/make" className="text-primary underline-offset-4 hover:underline">What can I make?</a>.
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <ShoppingBar checkedCount={checkedCount} />
            <ListGroupingToggle current={grouping} showLocations={showLocations} />
          </div>
          {groups ? (
            <div className="space-y-6">
              {groups.map((g) => (
                <section key={g.name}>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <span>{g.name}</span>
                    <Badge variant="secondary">{g.items.length}</Badge>
                  </h3>
                  <div className="divide-y rounded-lg border px-3">
                    {g.serial.map((item) => (
                      <ShoppingItemRow key={item.id} item={item} currency={currency} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="divide-y rounded-lg border px-3">
              {serial.map((item) => (
                <ShoppingItemRow key={item.id} item={item} currency={currency} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

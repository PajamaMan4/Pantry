import type { Metadata } from "next";
import { listIngredients } from "@/lib/db/ingredients";
import { listLocations } from "@/lib/db/locations";
import { LogPurchaseForm } from "../log-purchase-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Log purchase · Pantry" };

export default function LogPurchasePage() {
  const ingredients = listIngredients();
  const locations = listLocations();

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Log a purchase</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Just back from the store? Record what you bought to update stock and prices in one step.
      </p>
      <LogPurchaseForm
        ingredientOptions={ingredients.map((i) => ({ id: i.id, name: i.name, defaultUnit: i.defaultUnit }))}
        locations={locations.map((l) => ({ id: l.id, name: l.name }))}
      />
    </div>
  );
}

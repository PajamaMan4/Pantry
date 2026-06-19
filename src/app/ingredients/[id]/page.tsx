import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PriceChart } from "@/components/price-chart";
import { UnitSystemToggle } from "@/components/unit-system-toggle";
import { IngredientEditForm } from "../ingredient-edit-form";
import { DeletePriceButton } from "../delete-price-button";
import { AddInventory } from "../add-inventory";
import { InventoryItemRow, type SerialInventoryItem } from "../inventory-item-row";
import { PriceForms } from "../price-forms";
import { DeleteIngredientDialog } from "../delete-ingredient-dialog";
import { MergeIngredientDialog } from "../merge-ingredient-dialog";
import { AliasesSection } from "../aliases-section";
import { getIngredientDetail, listIngredients } from "@/lib/db/ingredients";
import { getSettings } from "@/lib/db/settings";
import { listLocations } from "@/lib/db/locations";
import { priceSummary } from "@/lib/domain/cost";
import { formatMoney, pricePerDisplayUnit, formatQuantityText } from "@/lib/domain/format";
import { displayQuantity, type DisplaySystem } from "@/lib/domain/scaling";
import type { RoundingMode } from "@/lib/domain/quantity";

export const dynamic = "force-dynamic";

function resolveSystem(units: string | undefined, fallback: "metric" | "imperial"): DisplaySystem {
  return units === "original" || units === "imperial" || units === "metric" ? units : fallback;
}

export default async function IngredientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const ingredientId = Number(id);
  if (!Number.isInteger(ingredientId)) notFound();

  const detail = getIngredientDetail(ingredientId);
  if (!detail) notFound();

  const { ingredient, inventory, recipes, priceEntries, aliases } = detail;
  const settings = getSettings();
  const locations = listLocations().map((l) => ({ id: l.id, name: l.name }));
  const now = new Date();
  const nowMs = now.getTime();
  const system = resolveSystem(
    Array.isArray(sp.units) ? sp.units[0] : sp.units,
    settings.unitSystem === "metric" ? "metric" : "imperial",
  );
  const rounding: RoundingMode = settings.roundingMode === "exact" ? "exact" : "cooking";

  const summary = priceSummary(
    priceEntries,
    { defaultUnit: ingredient.defaultUnit, density: ingredient.density },
    settings.averageWindowMonths,
    now,
  );
  const unitLabel = pricePerDisplayUnit(summary.average ?? 0, ingredient.defaultUnit, system).unitLabel;
  const perUnit = (v: number | null) =>
    v == null
      ? "—"
      : `${formatMoney(pricePerDisplayUnit(v, ingredient.defaultUnit, system).value, settings.currency)}/${unitLabel}`;
  const chartPoints = summary.points.map((p) => ({
    date: +p.date,
    price: pricePerDisplayUnit(p.price, ingredient.defaultUnit, system).value,
  }));

  const stockItems: SerialInventoryItem[] = inventory.map(({ item, location }) => ({
    id: item.id,
    quantity: item.quantity,
    unit: item.unit,
    locationId: item.locationId,
    locationName: location?.name ?? null,
    qtyDisplay: displayQuantity(
      { amount: item.quantity, amountMax: null, unit: item.unit, raw: null },
      { factor: 1, system, rounding },
    ),
    expiryMs: item.expiryDate?.getTime() ?? null,
    openedMs: item.openedDate?.getTime() ?? null,
    notes: item.notes,
  }));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link href="/ingredients" className="text-sm text-muted-foreground hover:text-foreground">
        ← Ingredients
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{ingredient.name}</h1>
          {ingredient.category && <Badge variant="secondary">{ingredient.category}</Badge>}
          {ingredient.isStaple && <Badge variant="outline">staple</Badge>}
        </div>
        <UnitSystemToggle current={system} />
      </div>

      {/* 1 — In Stock */}
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-medium">In stock</h2>
          <AddInventory ingredientId={ingredient.id} locations={locations} defaultUnit={ingredient.defaultUnit} />
        </div>
        {stockItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not currently in inventory.</p>
        ) : (
          <div className="divide-y rounded-lg border px-3">
            {stockItems.map((item) => (
              <InventoryItemRow
                key={item.id}
                item={item}
                ingredientId={ingredient.id}
                locations={locations}
                defaultUnit={ingredient.defaultUnit}
                nowMs={nowMs}
              />
            ))}
          </div>
        )}
      </section>

      <Separator className="my-6" />

      {/* 2 — Used In */}
      <section>
        <h2 className="mb-2 text-lg font-medium">Used in</h2>
        {recipes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recipes use this yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {recipes.map((r) => (
              <Link key={r.id} href={`/recipes/${r.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                {r.name}
              </Link>
            ))}
          </div>
        )}
      </section>

      <Separator className="my-6" />

      {/* 3 — Aliases */}
      <section>
        <h2 className="mb-2 text-lg font-medium">Aliases</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Other names for this ingredient. Typing any alias in the recipe editor will resolve to this ingredient instead of creating a duplicate.
        </p>
        <AliasesSection ingredientId={ingredient.id} initialAliases={aliases} />
      </section>

      <Separator className="my-6" />

      {/* 5 — Price History */}
      <section>
        <h2 className="mb-3 text-lg font-medium">Price history</h2>
        {summary.count === 0 ? (
          <p className="text-sm text-muted-foreground">No price data yet. Add one below.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Latest" value={perUnit(summary.latest)} />
              <Stat label={`Average (${summary.windowed ? `${settings.averageWindowMonths}mo` : "all-time"})`} value={perUnit(summary.average)} />
              <Stat label="Range" value={summary.min === summary.max ? "—" : `${perUnit(summary.min)} – ${perUnit(summary.max)}`} />
            </div>
            <div className="mt-4">
              <PriceChart points={chartPoints} currency={settings.currency} unitLabel={unitLabel} />
            </div>
          </>
        )}

        <div className="mt-4">
          <PriceForms ingredientId={ingredient.id} defaultUnit={ingredient.defaultUnit} locations={locations} />
        </div>

        {priceEntries.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {priceEntries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2">
                <span>
                  <span className="text-muted-foreground">{new Date(e.purchasedAt).toLocaleDateString()}</span>{" "}
                  {formatMoney(e.price, settings.currency)} for{" "}
                  {formatQuantityText({ amount: e.quantity, amountMax: null, unit: e.unit, raw: null })}
                  {e.store && <span className="text-muted-foreground"> · {e.store}</span>}
                </span>
                <DeletePriceButton id={e.id} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Separator className="my-6" />

      {/* 6 — Details */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <IngredientEditForm
              initial={{
                id: ingredient.id,
                name: ingredient.name,
                category: ingredient.category ?? "",
                defaultUnit: ingredient.defaultUnit ?? "",
                density: ingredient.density == null ? "" : String(ingredient.density),
                isStaple: ingredient.isStaple,
              }}
            />
          </CardContent>
        </Card>
      </section>

      <div className="mt-8 flex flex-wrap justify-end gap-2 border-t pt-6">
        <MergeIngredientDialog
          currentId={ingredient.id}
          currentName={ingredient.name}
          others={listIngredients()
            .filter((i) => i.id !== ingredient.id)
            .map((i) => ({ id: i.id, name: i.name }))}
        />
        <DeleteIngredientDialog id={ingredient.id} name={ingredient.name} recipeNames={recipes.map((r) => r.name)} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-sm font-medium tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

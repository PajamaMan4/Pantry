import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PriceSummaryInline } from "@/components/price-summary-inline";
import { ViewToggle } from "./view-toggle";
import { UnitSystemToggle } from "@/components/unit-system-toggle";
import { ClearStockButton } from "./clear-stock-button";
import { InventoryItemRow, type SerialInventoryItem } from "./inventory-item-row";
import { listIngredients, searchIngredients } from "@/lib/db/ingredients";
import { inventoryByIngredient, listInventory, type InventoryRow } from "@/lib/db/inventory";
import { listPriceEntriesFor } from "@/lib/db/prices";
import { listLocations } from "@/lib/db/locations";
import { getSettings } from "@/lib/db/settings";
import { priceSummary, type PriceSummary } from "@/lib/domain/cost";
import { displayQuantity, type DisplaySystem } from "@/lib/domain/scaling";
import type { RoundingMode } from "@/lib/domain/quantity";
import { formatMoney, pricePerDisplayUnit } from "@/lib/domain/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ingredients · Pantry" };

function resolveSystem(units: string | undefined, fallback: "metric" | "imperial"): DisplaySystem {
  return units === "original" || units === "imperial" || units === "metric" ? units : fallback;
}

function aggregateStock(items: InventoryRow[], system: DisplaySystem, rounding: RoundingMode): string | null {
  if (items.length === 0) return null;
  const byUnit = new Map<string, number>();
  for (const r of items) byUnit.set(r.item.unit, (byUnit.get(r.item.unit) ?? 0) + r.item.quantity);
  return [...byUnit.entries()]
    .map(([unit, qty]) => displayQuantity({ amount: qty, amountMax: null, unit, raw: null }, { factor: 1, system, rounding }))
    .join(" + ");
}

function priceText(summary: PriceSummary, currency: string, system: DisplaySystem): string {
  if (summary.count === 0 || summary.average == null) return "no price data";
  const ul = pricePerDisplayUnit(summary.average, summary.defaultUnit, system).unitLabel;
  const money = (v: number) => formatMoney(pricePerDisplayUnit(v, summary.defaultUnit, system).value, currency);
  if (summary.count === 1 || summary.min === summary.max) return `${money(summary.average)}/${ul}`;
  return `${money(summary.min!)}–${money(summary.max!)}/${ul} · avg ${money(summary.average)}/${ul}`;
}

function serialItem(r: InventoryRow, system: DisplaySystem, rounding: RoundingMode): SerialInventoryItem {
  return {
    id: r.item.id,
    quantity: r.item.quantity,
    unit: r.item.unit,
    locationId: r.item.locationId,
    locationName: r.location?.name ?? null,
    qtyDisplay: displayQuantity({ amount: r.item.quantity, amountMax: null, unit: r.item.unit, raw: null }, { factor: 1, system, rounding }),
    expiryMs: r.item.expiryDate?.getTime() ?? null,
    openedMs: r.item.openedDate?.getTime() ?? null,
    notes: r.item.notes,
  };
}

export default async function IngredientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const str = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const q = (str("q") ?? "").trim();

  const settings = getSettings();
  const view = settings.inventoryView === "location" ? "location" : "alphabetical";
  const system = resolveSystem(str("units"), settings.unitSystem === "metric" ? "metric" : "imperial");
  const rounding: RoundingMode = settings.roundingMode === "exact" ? "exact" : "cooking";
  const now = new Date();
  const nowMs = now.getTime();
  const locations = listLocations().map((l) => ({ id: l.id, name: l.name }));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Ingredients</h1>
        <Link href="/ingredients/new" className={buttonVariants()}>
          <PlusIcon className="size-4" /> New ingredient
        </Link>
      </div>

      <form action="/ingredients" className="mb-3">
        <input type="hidden" name="units" value={str("units") ?? ""} />
        <Input name="q" defaultValue={q} placeholder="Search ingredients…" className="w-full" />
      </form>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <ViewToggle current={view} />
        <div className="flex items-center gap-2">
          <span>Units</span>
          <UnitSystemToggle current={system} />
        </div>
      </div>

      {view === "alphabetical" ? (
        <AlphabeticalView q={q} system={system} rounding={rounding} currency={settings.currency} windowMonths={settings.averageWindowMonths} now={now} />
      ) : (
        <LocationView
          q={q}
          system={system}
          rounding={rounding}
          currency={settings.currency}
          windowMonths={settings.averageWindowMonths}
          now={now}
          nowMs={nowMs}
          locations={locations}
        />
      )}
    </div>
  );
}

// ---- Alphabetical: all ingredients, flat ----
function AlphabeticalView({
  q,
  system,
  rounding,
  currency,
  windowMonths,
  now,
}: {
  q: string;
  system: DisplaySystem;
  rounding: RoundingMode;
  currency: string;
  windowMonths: number;
  now: Date;
}) {
  const ingredients = q ? searchIngredients(q, 500) : listIngredients();
  const invByIng = inventoryByIngredient();
  const priceMap = listPriceEntriesFor(ingredients.map((i) => i.id));

  if (ingredients.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {q ? "No ingredients match." : "No ingredients yet."}{" "}
        <Link href="/ingredients/new" className="text-primary underline-offset-4 hover:underline">
          Create one
        </Link>
        .
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-lg border px-3">
      {ingredients.map((ing) => {
        const items = invByIng.get(ing.id) ?? [];
        const summary = priceSummary(priceMap.get(ing.id) ?? [], { defaultUnit: ing.defaultUnit, density: ing.density }, windowMonths, now);
        const stock = aggregateStock(items, system, rounding);
        return (
          <li key={ing.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link href={`/ingredients/${ing.id}`} className="font-medium hover:underline">
                  {ing.name}
                </Link>
                {ing.category && <Badge variant="secondary">{ing.category}</Badge>}
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="tabular-nums">{stock ?? "not in stock"}</span>
                <span className="mx-2">·</span>
                <PriceSummaryInline summary={summary} currency={currency} system={system} />
              </div>
            </div>
            {items.length > 0 && <ClearStockButton ingredientId={ing.id} name={ing.name} />}
          </li>
        );
      })}
    </ul>
  );
}

// ---- By location: inventory items grouped, with inline edit + delete ----
function LocationView({
  q,
  system,
  rounding,
  currency,
  windowMonths,
  now,
  nowMs,
  locations,
}: {
  q: string;
  system: DisplaySystem;
  rounding: RoundingMode;
  currency: string;
  windowMonths: number;
  now: Date;
  nowMs: number;
  locations: { id: number; name: string }[];
}) {
  let rows = listInventory();
  if (q) rows = rows.filter((r) => r.ingredient.name.toLowerCase().includes(q.toLowerCase()));

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {q ? "No stocked ingredients match." : "Nothing in stock yet."}
      </p>
    );
  }

  const priceMap = listPriceEntriesFor([...new Set(rows.map((r) => r.ingredient.id))]);
  const priceTextFor = (r: InventoryRow) => {
    const summary = priceSummary(priceMap.get(r.ingredient.id) ?? [], { defaultUnit: r.ingredient.defaultUnit, density: r.ingredient.density }, windowMonths, now);
    return priceText(summary, currency, system);
  };

  const groups = new Map<string, { sortOrder: number; rows: InventoryRow[] }>();
  for (const r of rows) {
    const name = r.location?.name ?? "Unsorted";
    const sortOrder = r.location?.sortOrder ?? 9999;
    const g = groups.get(name) ?? { sortOrder, rows: [] };
    g.rows.push(r);
    groups.set(name, g);
  }
  const ordered = [...groups.entries()].sort((a, b) => a[1].sortOrder - b[1].sortOrder);

  return (
    <div className="space-y-6">
      {ordered.map(([name, g]) => (
        <section key={name}>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">{name}</h2>
          <div className="divide-y rounded-lg border px-3">
            {g.rows.map((r) => (
              <InventoryItemRow
                key={r.item.id}
                item={serialItem(r, system, rounding)}
                ingredientId={r.ingredient.id}
                locations={locations}
                defaultUnit={r.ingredient.defaultUnit}
                nowMs={nowMs}
                name={r.ingredient.name}
                href={`/ingredients/${r.ingredient.id}`}
                priceText={priceTextFor(r)}
                showLocation={false}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

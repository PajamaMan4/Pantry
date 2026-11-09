import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PriceSummaryInline } from "@/components/price-summary-inline";
import { ListPagination } from "@/components/list-pagination";
import { ViewToggle } from "./view-toggle";
import { IngredientsActionsMenu } from "./ingredients-actions-menu";
import { ClearStockButton } from "./clear-stock-button";
import { InventoryItemRow, type SerialInventoryItem } from "./inventory-item-row";
import { InventorySortProvider } from "./inventory-sort-context";
import { listIngredients, searchIngredients } from "@/lib/db/ingredients";
import { inventoryByIngredient, listInventory, type InventoryRow } from "@/lib/db/inventory";
import { listPriceEntriesFor } from "@/lib/db/prices";
import { listLocations } from "@/lib/db/locations";
import { getSettings } from "@/lib/db/settings";
import { groupByLocation } from "@/lib/domain/location-groups";
import { groupByCategory } from "@/lib/domain/category-groups";
import { priceSummary, type PriceSummary } from "@/lib/domain/cost";
import { paginate, parsePageParam, resolvePageSize } from "@/lib/domain/pagination";
import { displayQuantity, toDisplaySystem, type DisplaySystem } from "@/lib/domain/scaling";
import { aggregateStock } from "@/lib/domain/stock-total";
import type { RoundingMode } from "@/lib/domain/quantity";
import { formatMoney, pricePerDisplayUnit } from "@/lib/domain/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ingredients · Pantry" };

// Ceiling on how many *matches* a dictionary search considers, not a page size:
// pagination walks within this, so a search can never reach match 501.
const SEARCH_LIMIT = 500;

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
  const showLocations = settings.showLocations;
  const view = settings.inventoryView === "location" ? "location" : "alphabetical";
  const system = toDisplaySystem(str("units"), toDisplaySystem(settings.unitSystem));
  const rounding: RoundingMode = settings.roundingMode === "exact" ? "exact" : "cooking";
  const now = new Date();
  const nowMs = now.getTime();
  const locations = listLocations().map((l) => ({ id: l.id, name: l.name }));

  // Dictionary view only — the inventory view stays a full grouped list.
  const page = parsePageParam(str("page"));
  const pageSize = resolvePageSize(settings.ingredientsPerPage);

  // Preserves `q` and `units`; `page` is omitted on page 1 so the canonical
  // first-page URL is just /ingredients (same convention as the recipes list).
  function buildPageUrl(p: number) {
    const next = new URLSearchParams();
    const units = str("units");
    if (units) next.set("units", units);
    if (q) next.set("q", q);
    if (p > 1) next.set("page", String(p));
    const qs = next.toString();
    return qs ? `/ingredients?${qs}` : "/ingredients";
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Ingredients</h1>
        <IngredientsActionsMenu system={system} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <ViewToggle current={view} />
      </div>

      {/* GET form: it submits only the fields below, so `page` is dropped from the
          URL and a new search always lands on page 1. Don't add a hidden page input. */}
      <form action="/ingredients" className="mb-6">
        <input type="hidden" name="units" value={str("units") ?? ""} />
        <Input name="q" defaultValue={q} placeholder="Search ingredients…" className="w-full" />
      </form>

      {view === "alphabetical" ? (
        <AlphabeticalView
          q={q}
          system={system}
          rounding={rounding}
          currency={settings.currency}
          windowMonths={settings.averageWindowMonths}
          now={now}
          page={page}
          pageSize={pageSize}
          buildPageUrl={buildPageUrl}
        />
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
          showLocations={showLocations}
        />
      )}
    </div>
  );
}

// ---- Alphabetical: all ingredients, flat, one page at a time ----
function AlphabeticalView({
  q,
  system,
  rounding,
  currency,
  windowMonths,
  now,
  page,
  pageSize,
  buildPageUrl,
}: {
  q: string;
  system: DisplaySystem;
  rounding: RoundingMode;
  currency: string;
  windowMonths: number;
  now: Date;
  page: number | undefined;
  pageSize: number;
  buildPageUrl: (page: number) => string;
}) {
  const all = q ? searchIngredients(q, SEARCH_LIMIT) : listIngredients();
  const pageInfo = paginate(all.length, pageSize, page);
  const ingredients = all.slice(pageInfo.startIndex, pageInfo.endIndex);

  const invByIng = inventoryByIngredient();
  // Scoped to the visible page — this used to load prices for the whole table.
  const priceMap = listPriceEntriesFor(ingredients.map((i) => i.id));

  // Guards the whole list, not the current slice: `paginate` clamps an
  // out-of-range `?page=`, so an empty slice here would mean an empty DB anyway.
  if (pageInfo.totalItems === 0) {
    return (
      <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        {q ? "No ingredients match." : "No ingredients yet."}{" "}
        <Link href="/ingredients/new" className="text-primary underline-offset-4 hover:underline">
          Create one
        </Link>
        {q ? null : (
          <>
            {" "}
            or{" "}
            <Link
              href="/ingredients/inventory/add"
              className="text-primary underline-offset-4 hover:underline"
            >
              add stock in bulk
            </Link>
          </>
        )}
        .
      </p>
    );
  }

  return (
    <>
      <ul className="divide-y rounded-lg border px-3">
        {ingredients.map((ing) => {
          const items = invByIng.get(ing.id) ?? [];
          const summary = priceSummary(priceMap.get(ing.id) ?? [], { defaultUnit: ing.defaultUnit, density: ing.density, gramsPerEach: ing.gramsPerEach }, windowMonths, now);
          const stock = aggregateStock(items.map((r) => r.item), system, rounding, ing.density);
          return (
            <li key={ing.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <Link href={`/ingredients/${ing.id}`} className="font-medium capitalize hover:underline">
                  {ing.name}
                </Link>
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

      <ListPagination info={pageInfo} buildHref={buildPageUrl} label="Ingredient pages" />
    </>
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
  showLocations,
}: {
  q: string;
  system: DisplaySystem;
  rounding: RoundingMode;
  currency: string;
  windowMonths: number;
  now: Date;
  nowMs: number;
  locations: { id: number; name: string }[];
  showLocations: boolean;
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
    const summary = priceSummary(priceMap.get(r.ingredient.id) ?? [], { defaultUnit: r.ingredient.defaultUnit, density: r.ingredient.density, gramsPerEach: r.ingredient.gramsPerEach }, windowMonths, now);
    return priceText(summary, currency, system);
  };

  const row = (r: InventoryRow) => (
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
  );

  // Locations shown -> group by storage location, with drag/tap-to-move
  // (InventorySortProvider). Locations hidden -> group by category instead;
  // there's no location to move an item to, so no provider, no move button.
  const groups: { name: string; items: InventoryRow[] }[] = showLocations
    ? groupByLocation(rows, (r) => r.location)
    : groupByCategory(rows, (r) => r.ingredient.category);

  const sections = (
    <div className="space-y-6">
      {groups.map((g) => (
        <Collapsible key={g.name} defaultOpen={false} render={<section />}>
          <CollapsibleTrigger
            render={
              <button
                type="button"
                className="group mb-2 flex w-full items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              />
            }
          >
            <ChevronDownIcon className="size-4 transition-transform group-data-[panel-open]:rotate-180" />
            <span>{g.name}</span>
            <Badge variant="secondary" className="ml-1">
              {g.items.length}
            </Badge>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="divide-y rounded-lg border px-3">{g.items.map(row)}</div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );

  return showLocations ? (
    <InventorySortProvider locations={locations}>{sections}</InventorySortProvider>
  ) : (
    sections
  );
}

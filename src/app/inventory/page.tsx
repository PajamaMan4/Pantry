import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, ShoppingCartIcon, PencilIcon, AlertTriangleIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpiryBadge } from "@/components/expiry-badge";
import { PriceSummaryInline } from "@/components/price-summary-inline";
import { DeleteItemButton } from "./delete-item-button";
import { listInventory, type InventoryRow } from "@/lib/db/inventory";
import { listPriceEntriesFor } from "@/lib/db/prices";
import { getSettings } from "@/lib/db/settings";
import { priceSummary, type PriceSummary } from "@/lib/domain/cost";
import { expiryStatus, type ExpiryStatus } from "@/lib/domain/expiry";
import { formatQuantityText } from "@/lib/domain/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inventory · Pantry" };

type EnrichedRow = InventoryRow & { summary: PriceSummary; status: ExpiryStatus | null };

export default function InventoryPage() {
  const rows = listInventory();
  const settings = getSettings();
  const now = new Date();
  const priceMap = listPriceEntriesFor([...new Set(rows.map((r) => r.ingredient.id))]);

  const enriched: EnrichedRow[] = rows.map((r) => {
    const entries = priceMap.get(r.ingredient.id) ?? [];
    const summary = priceSummary(
      entries,
      { defaultUnit: r.ingredient.defaultUnit, density: r.ingredient.density },
      settings.averageWindowMonths,
      now,
    );
    return { ...r, summary, status: expiryStatus(r.item.expiryDate, now) };
  });

  const useSoon = enriched
    .filter((e) => e.status === "expired" || e.status === "soon")
    .sort((a, b) => (a.item.expiryDate?.getTime() ?? Infinity) - (b.item.expiryDate?.getTime() ?? Infinity));

  // Group by location, ordered by the location's sortOrder; unassigned last.
  const groups = new Map<string, { sortOrder: number; rows: EnrichedRow[] }>();
  for (const e of enriched) {
    const name = e.location?.name ?? "Unsorted";
    const sortOrder = e.location?.sortOrder ?? 9999;
    const g = groups.get(name) ?? { sortOrder, rows: [] };
    g.rows.push(e);
    groups.set(name, g);
  }
  const orderedGroups = [...groups.entries()].sort((a, b) => a[1].sortOrder - b[1].sortOrder);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
        <div className="flex gap-2">
          <Link href="/inventory/purchase" className={buttonVariants({ variant: "outline" })}>
            <ShoppingCartIcon className="size-4" /> Log purchase
          </Link>
          <Link href="/inventory/new" className={buttonVariants()}>
            <PlusIcon className="size-4" /> Add item
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nothing in stock yet.{" "}
          <Link href="/inventory/purchase" className="text-primary underline-offset-4 hover:underline">
            Log a purchase
          </Link>{" "}
          or{" "}
          <Link href="/inventory/new" className="text-primary underline-offset-4 hover:underline">
            add an item
          </Link>
          .
        </p>
      ) : (
        <div className="space-y-6">
          {useSoon.length > 0 && (
            <Card className="border-amber-300 dark:border-amber-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangleIcon className="size-4 text-amber-500" /> Use soon
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y">
                {useSoon.map((e) => (
                  <Row key={`soon-${e.item.id}`} e={e} currency={settings.currency} now={now} />
                ))}
              </CardContent>
            </Card>
          )}

          {orderedGroups.map(([name, g]) => (
            <section key={name}>
              <h2 className="mb-2 text-sm font-medium text-muted-foreground">{name}</h2>
              <div className="divide-y rounded-lg border px-3">
                {g.rows.map((e) => (
                  <Row key={e.item.id} e={e} currency={settings.currency} now={now} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ e, currency, now }: { e: EnrichedRow; currency: string; now: Date }) {
  const qty = formatQuantityText({
    amount: e.item.quantity,
    amountMax: null,
    unit: e.item.unit,
    raw: null,
  });
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <Link href={`/ingredients/${e.ingredient.id}`} className="font-medium hover:underline">
          {e.ingredient.name}
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">{qty}</span>
          {e.item.quantity === 0 && (
            <Badge variant="outline" className="text-[10px]">
              out of stock
            </Badge>
          )}
          <ExpiryBadge expiry={e.item.expiryDate} now={now} />
        </div>
        <PriceSummaryInline summary={e.summary} currency={currency} />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Link
          href={`/inventory/${e.item.id}/edit`}
          className={buttonVariants({ variant: "ghost", size: "icon" })}
          aria-label="Edit"
        >
          <PencilIcon className="size-4" />
        </Link>
        <DeleteItemButton id={e.item.id} name={e.ingredient.name} />
      </div>
    </div>
  );
}

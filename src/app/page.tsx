import Link from "next/link";
import { sql } from "drizzle-orm";
import { AlertTriangleIcon } from "lucide-react";
import { db } from "@/lib/db/client";
import { ingredients, recipes, inventoryItems, priceEntries } from "@/lib/db/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listInventory } from "@/lib/db/inventory";
import { expiryStatus } from "@/lib/domain/expiry";

// Reads the DB, so render per-request.
export const dynamic = "force-dynamic";

export default function Home() {
  const now = new Date();
  const stats = {
    recipes: db.select({ n: sql<number>`count(*)` }).from(recipes).get()?.n ?? 0,
    ingredients: db.select({ n: sql<number>`count(*)` }).from(ingredients).get()?.n ?? 0,
    inventory: db.select({ n: sql<number>`count(*)` }).from(inventoryItems).get()?.n ?? 0,
    prices: db.select({ n: sql<number>`count(*)` }).from(priceEntries).get()?.n ?? 0,
  };
  const useSoon = listInventory().filter((r) => {
    const s = expiryStatus(r.item.expiryDate, now);
    return s === "expired" || s === "soon";
  }).length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Pantry</h1>
        <p className="mt-1 text-muted-foreground">
          Your personal cooking &amp; kitchen-management app. Local-first, single-user.
        </p>
      </header>

      {useSoon > 0 && (
        <Link
          href="/inventory"
          className="mb-6 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm dark:border-amber-800 dark:bg-amber-950/40"
        >
          <AlertTriangleIcon className="size-4 text-amber-500" />
          <span>
            <strong>{useSoon}</strong> item{useSoon === 1 ? "" : "s"} to use soon or expired.
          </span>
          <span className="ml-auto text-muted-foreground">View →</span>
        </Link>
      )}

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Recipes" value={stats.recipes} />
        <Stat label="Ingredients" value={stats.ingredients} />
        <Stat label="In stock" value={stats.inventory} />
        <Stat label="Price entries" value={stats.prices} />
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <QuickLink href="/recipes" title="Recipes" desc="Browse, search & filter." cta="View recipes →" />
        <QuickLink href="/recipes/new" title="Add a recipe" desc="Ingredients, steps, tags." cta="New recipe →" />
        <QuickLink href="/inventory" title="Inventory" desc="Stock, expiry & prices." cta="View inventory →" />
        <QuickLink href="/inventory/purchase" title="Log a purchase" desc="Update stock + prices." cta="Log purchase →" />
        <QuickLink href="/settings" title="Settings" desc="Units, pricing, rounding." cta="Open settings →" />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function QuickLink({ href, title, desc, cta }: { href: string; title: string; desc: string; cta: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        <Link href={href} className="font-medium text-primary underline-offset-4 hover:underline">
          {cta}
        </Link>
      </CardContent>
    </Card>
  );
}

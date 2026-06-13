import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { ingredients, recipes, inventoryItems, priceEntries } from "@/lib/db/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Reads the DB, so render per-request.
export const dynamic = "force-dynamic";

export default function Home() {
  const stats = {
    recipes: db.select({ n: sql<number>`count(*)` }).from(recipes).get()?.n ?? 0,
    ingredients: db.select({ n: sql<number>`count(*)` }).from(ingredients).get()?.n ?? 0,
    inventory: db.select({ n: sql<number>`count(*)` }).from(inventoryItems).get()?.n ?? 0,
    prices: db.select({ n: sql<number>`count(*)` }).from(priceEntries).get()?.n ?? 0,
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Pantry</h1>
        <p className="mt-1 text-muted-foreground">
          Your personal cooking &amp; kitchen-management app. Local-first, single-user.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Recipes" value={stats.recipes} />
        <Stat label="Ingredients" value={stats.ingredients} />
        <Stat label="In stock" value={stats.inventory} />
        <Stat label="Price entries" value={stats.prices} />
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Phase 0 complete</CardTitle>
            <CardDescription>Project &amp; data layer are in place.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            SQLite (WAL) + Drizzle schema, migrations, seed, and backups are wired up. The
            domain layer (units, scaling, cost, recommendations) and feature screens arrive in
            later phases.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Units, pricing, rounding.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <Link href="/settings" className="font-medium text-primary underline-offset-4 hover:underline">
              Open settings →
            </Link>
          </CardContent>
        </Card>
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

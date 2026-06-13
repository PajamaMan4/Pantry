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

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Recipes</CardTitle>
            <CardDescription>Browse, search &amp; filter.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <Link href="/recipes" className="font-medium text-primary underline-offset-4 hover:underline">
              View recipes →
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add a recipe</CardTitle>
            <CardDescription>Ingredients, steps, tags.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <Link href="/recipes/new" className="font-medium text-primary underline-offset-4 hover:underline">
              New recipe →
            </Link>
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

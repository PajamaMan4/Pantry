import Link from "next/link";
import { sql } from "drizzle-orm";
import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";
import { db } from "@/lib/db/client";
import { ingredients, recipes, inventoryItems, priceEntries } from "@/lib/db/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExpiryBadge } from "@/components/expiry-badge";
import { listInventory } from "@/lib/db/inventory";
import { getRecommendations } from "@/lib/db/recommend";
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
  const expiringItems = listInventory()
    .map((r) => ({ row: r, status: expiryStatus(r.item.expiryDate, now) }))
    .filter((x) => x.status === "expired" || x.status === "soon")
    .sort((a, b) => (a.row.item.expiryDate?.getTime() ?? Infinity) - (b.row.item.expiryDate?.getTime() ?? Infinity));
  const suggestions = getRecommendations("available")
    .results.filter((r) => r.makeable || r.almost)
    .slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Pantry</h1>
        <p className="mt-1 text-muted-foreground">
          Your personal cooking &amp; kitchen-management app. Local-first, single-user.
        </p>
      </header>

      {expiringItems.length > 0 && (
        <Card className="mb-6 border-amber-300 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangleIcon className="size-4 text-amber-500" /> Use soon
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y py-0">
            {expiringItems.slice(0, 6).map(({ row }) => (
              <div key={row.item.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <Link href={`/ingredients/${row.ingredient.id}`} className="font-medium hover:underline">
                  {row.ingredient.name}
                </Link>
                <ExpiryBadge expiry={row.item.expiryDate} now={now} />
              </div>
            ))}
            {expiringItems.length > 6 && (
              <div className="py-2 text-xs text-muted-foreground">+{expiringItems.length - 6} more</div>
            )}
          </CardContent>
        </Card>
      )}

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Recipes" value={stats.recipes} />
        <Stat label="Ingredients" value={stats.ingredients} />
        <Stat label="In stock" value={stats.inventory} />
        <Stat label="Price entries" value={stats.prices} />
      </section>

      {suggestions.length > 0 && (
        <section className="mt-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-medium">What can I make?</h2>
            <Link href="/make" className="text-sm text-primary underline-offset-4 hover:underline">
              See all →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {suggestions.map((r) => (
              <Card key={r.recipe.id} className={r.makeable ? "border-emerald-300 dark:border-emerald-800" : undefined}>
                <CardContent className="flex items-center justify-between gap-2 py-3">
                  <Link href={`/recipes/${r.recipe.id}`} className="font-medium hover:underline">
                    {r.recipe.name}
                  </Link>
                  {r.makeable ? (
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      <CheckCircle2Icon className="size-3.5" /> makeable
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {r.haveCount}/{r.requiredCount}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <QuickLink href="/make" title="What can I make?" desc="Suggestions from your stock." cta="Get ideas →" />
        <QuickLink href="/recipes" title="Recipes" desc="Browse, search & filter." cta="View recipes →" />
        <QuickLink href="/recipes/new" title="Add a recipe" desc="Ingredients, steps, tags." cta="New recipe →" />
        <QuickLink href="/ingredients" title="Ingredients" desc="Stock, expiry & prices." cta="View ingredients →" />
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

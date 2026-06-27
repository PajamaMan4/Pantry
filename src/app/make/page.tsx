import type { Metadata } from "next";
import Link from "next/link";
import { CoinsIcon, ClockAlertIcon, CheckCircle2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddMissingButton } from "./add-missing-button";
import { getRecommendations } from "@/lib/db/recommend";
import { getSettings } from "@/lib/db/settings";
import { formatMoney } from "@/lib/domain/format";
import type { RecommendSort, RecommendResult } from "@/lib/domain/recommend";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "What can I make? · Pantry" };

const SORTS: { value: RecommendSort; label: string }[] = [
  { value: "available", label: "Most available" },
  { value: "expiring", label: "Use soon" },
  { value: "cost", label: "Cheapest" },
];

function resolveSort(v: string | undefined): RecommendSort {
  return v === "expiring" || v === "cost" ? v : "available";
}

export default async function MakePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const sort = resolveSort(Array.isArray(sp.sort) ? sp.sort[0] : sp.sort);
  const { results, ingredientNames } = getRecommendations(sort);
  const { currency } = getSettings();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">What can I make?</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Suggestions from what&apos;s in your inventory. Staples are assumed on hand; optional
        ingredients don&apos;t count against a recipe.
      </p>

      <div className="mb-6 flex items-center gap-1 rounded-md border p-0.5 text-xs w-fit">
        {SORTS.map((s) => (
          <Link
            key={s.value}
            href={`/make?sort=${s.value}`}
            className={cn(
              "rounded-sm px-2.5 py-1 font-medium transition-colors",
              sort === s.value ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {results.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No recipes yet. <Link href="/recipes/new" className="text-primary underline-offset-4 hover:underline">Add one</Link>.
        </p>
      ) : (
        <div className="space-y-3">
          {results.map((r) => (
            <RecommendCard key={r.recipe.id} r={r} names={ingredientNames} currency={currency} />
          ))}
        </div>
      )}
    </div>
  );
}

function RecommendCard({
  r,
  names,
  currency,
}: {
  r: RecommendResult;
  names: Map<number, string>;
  currency: string;
}) {
  const missingNames = r.missing.map((id) => names.get(id) ?? "?");
  return (
    <Card className={cn(r.makeable && "border-emerald-300 dark:border-emerald-800")}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/recipes/${r.recipe.id}`} className="font-medium hover:underline">
            {r.recipe.name}
          </Link>
          {r.makeable ? (
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <CheckCircle2Icon className="size-3.5" /> makeable
            </Badge>
          ) : r.almost ? (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">almost there</Badge>
          ) : (
            <Badge variant="secondary">
              {r.haveCount}/{r.requiredCount}
            </Badge>
          )}
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>
            {r.haveCount}/{r.requiredCount} ingredients
          </span>
          {r.cost != null && (
            <span className="inline-flex items-center gap-1">
              <CoinsIcon className="size-4" /> {formatMoney(r.cost, currency)}/serving
            </span>
          )}
          {r.expiryUrgency > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <ClockAlertIcon className="size-4" /> uses expiring stock
            </span>
          )}
        </div>

        {missingNames.length > 0 && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="min-w-0 flex-1 truncate text-sm">
              <span className="text-muted-foreground">Missing:</span>{" "}
              {missingNames.join(", ")}
              {r.unknownUnits > 0 && (
                <span className="text-muted-foreground"> ({r.unknownUnits} can&apos;t be checked)</span>
              )}
            </p>
            <AddMissingButton recipeId={r.recipe.id} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

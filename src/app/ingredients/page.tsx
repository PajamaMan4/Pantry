import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { listIngredients, searchIngredients } from "@/lib/db/ingredients";
import { unitLabel } from "@/lib/domain/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ingredients · Pantry" };

export default async function IngredientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "";
  const ingredients = q.trim() ? searchIngredients(q, 200) : listIngredients();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Ingredients</h1>
        <Link href="/ingredients/new" className={buttonVariants()}>
          <PlusIcon className="size-4" /> New ingredient
        </Link>
      </div>

      <form className="mb-6" action="/ingredients">
        <Input name="q" defaultValue={q} placeholder="Search ingredients…" className="w-full" />
      </form>

      {ingredients.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {q.trim() ? "No ingredients match." : "No ingredients yet."}{" "}
          <Link href="/ingredients/new" className="text-primary underline-offset-4 hover:underline">
            Create one
          </Link>
          .
        </p>
      ) : (
        <ul className="divide-y rounded-lg border px-3">
          {ingredients.map((ing) => (
            <li key={ing.id} className="flex items-center justify-between gap-3 py-2.5">
              <Link href={`/ingredients/${ing.id}`} className="font-medium hover:underline">
                {ing.name}
              </Link>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {ing.category && <Badge variant="secondary">{ing.category}</Badge>}
                {ing.isStaple && <Badge variant="outline">staple</Badge>}
                {ing.defaultUnit && <span>{unitLabel(ing.defaultUnit)}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

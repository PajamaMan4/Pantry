import type { Metadata } from "next";
import Link from "next/link";
import { IngredientEditForm } from "../ingredient-edit-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New ingredient · Pantry" };

export default function NewIngredientPage() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <Link href="/ingredients" className="text-sm text-muted-foreground hover:text-foreground">
        ← Ingredients
      </Link>
      <h1 className="mt-3 mb-1 text-2xl font-semibold tracking-tight">New ingredient</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Create an ingredient so you can track its price even before it&apos;s used in a recipe.
      </p>
      <IngredientEditForm
        initial={{ name: "", category: "", defaultUnit: "", density: "", gramsPerEach: "", isStaple: false }}
      />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resolveAnthropicApiKey } from "@/lib/db/settings";
import { ImportForm } from "./import-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Import recipe · Pantry" };

export default function ImportRecipePage() {
  const hasKey = resolveAnthropicApiKey() != null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link href="/recipes" className="text-sm text-muted-foreground hover:text-foreground">
        ← All recipes
      </Link>

      <Card className="mt-3">
        <CardHeader>
          <CardTitle>Import a recipe</CardTitle>
          <CardDescription>
            Paste raw recipe text and Claude will structure it — name, servings, times, ingredients,
            and steps — into a draft you can review and edit before saving.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImportForm hasKey={hasKey} />
        </CardContent>
      </Card>
    </div>
  );
}

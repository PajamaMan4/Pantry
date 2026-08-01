import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { resolveAnthropicApiKey } from "@/lib/db/settings";
import { ImportForm } from "./import-form";
import { PantryFileImport } from "./pantry-file-import";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Import recipe · Pantry" };

export default function ImportRecipePage() {
  const hasKey = resolveAnthropicApiKey() != null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link href="/recipes" className="text-sm text-muted-foreground hover:text-foreground">
        ← All recipes
      </Link>

      <div className="mt-3 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Import a .pantry file</CardTitle>
            <CardDescription>
              Import a recipe exported from Pantry. The file will be loaded as a draft
              you can review and edit before saving.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PantryFileImport />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import from text with AI</CardTitle>
            <CardDescription>
              {hasKey ? (
                <>
                  Paste raw recipe text and Claude will structure it — name, servings, times,
                  ingredients, and steps — into a draft you can review and edit before saving.
                </>
              ) : (
                <>
                  Add an Anthropic API key in{" "}
                  <Link href="/settings" className="underline underline-offset-4">
                    Settings
                  </Link>{" "}
                  to enable AI import.
                </>
              )}
            </CardDescription>
          </CardHeader>
          {hasKey && (
            <CardContent>
              <ImportForm />
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}

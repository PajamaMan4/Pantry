import type { Metadata } from "next";
import Link from "next/link";
import { DownloadIcon } from "lucide-react";
import { getSettings, resolveAnthropicApiKey } from "@/lib/db/settings";
import { listLocations } from "@/lib/db/locations";
import { listTagsWithCounts } from "@/lib/db/tags";
import { listCategoriesWithCounts } from "@/lib/db/ingredients";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { SettingsForm } from "./settings-form";
import { LocationManager } from "./location-manager";
import { TaxonomyManager } from "./taxonomy-manager";
import { ApiKeyForm } from "./api-key-form";
import { PageHelpMenu } from "@/components/help/page-help-menu";

// Reads the DB on every request — never statically prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings · Pantry",
};

export default function SettingsPage() {
  const settings = getSettings();
  const locations = listLocations().map((l) => ({ id: l.id, name: l.name }));
  const tagItems = listTagsWithCounts().map((t) => ({ key: String(t.id), name: t.name, count: t.count }));
  const categoryItems = listCategoriesWithCounts().map((c) => ({ key: c.name, name: c.name, count: c.count }));
  const hasApiKey = resolveAnthropicApiKey() != null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Units, pricing, and rounding preferences for the whole app.
          </CardDescription>
          <CardAction>
            <PageHelpMenu topicId="settings" />
          </CardAction>
        </CardHeader>
        <CardContent>
          <SettingsForm initial={settings} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How to use Pantry</CardTitle>
          <CardDescription>
            New here? A short guide to every part of Pantry — recipes, inventory, the menu, and
            more.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/settings/guide"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Open the guide →
          </Link>
        </CardContent>
      </Card>

      {settings.showLocations && (
        <Card>
          <CardHeader>
            <CardTitle>Storage locations</CardTitle>
            <CardDescription>
              Where inventory is stored. Rename or remove locations; removing one keeps the stock and
              moves it to “Unsorted”. Hidden throughout the app while “Show storage locations” is off.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LocationManager locations={locations} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recipe tags</CardTitle>
          <CardDescription>
            Fix typos and tidy up tags. Rename one, delete it, or merge it into another — every recipe
            with the merged tag is retagged automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaxonomyManager kind="tag" items={tagItems} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ingredient categories</CardTitle>
          <CardDescription>
            Rename, delete, or merge ingredient categories. Deleting one leaves its ingredients
            “Uncategorized”.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TaxonomyManager kind="category" items={categoryItems} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recipe import (AI)</CardTitle>
          <CardDescription>
            An Anthropic API key enables pasting raw recipe text and having Claude structure it.
            Optional — recipes can always be entered manually.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ApiKeyForm hasKey={hasApiKey} />
          <div className="border-t pt-4">
            <p className="mb-2 text-sm text-muted-foreground">
              Share this schema with Claude to generate or convert recipes in the .pantry format.
            </p>
            <a
              href="/api/schema/pantry"
              download="pantry-file.ts"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <DownloadIcon className="size-4" />
              Export .pantry JSON schema
            </a>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data &amp; backups</CardTitle>
          <CardDescription>
            Export a snapshot, create backups, or restore the database from a file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/data"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Open data &amp; backups →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

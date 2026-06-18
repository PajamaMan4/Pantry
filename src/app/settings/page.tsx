import type { Metadata } from "next";
import Link from "next/link";
import { DownloadIcon } from "lucide-react";
import { getSettings, resolveAnthropicApiKey } from "@/lib/db/settings";
import { listLocations } from "@/lib/db/locations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { SettingsForm } from "./settings-form";
import { LocationManager } from "./location-manager";
import { ApiKeyForm } from "./api-key-form";

// Reads the DB on every request — never statically prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings · Pantry",
};

export default function SettingsPage() {
  const settings = getSettings();
  const locations = listLocations().map((l) => ({ id: l.id, name: l.name }));
  const hasApiKey = resolveAnthropicApiKey() != null;

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Units, pricing, and rounding preferences for the whole app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm initial={settings} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Storage locations</CardTitle>
          <CardDescription>
            Where inventory is stored. Rename or remove locations; removing one keeps the stock and
            moves it to “Unsorted”.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LocationManager locations={locations} />
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

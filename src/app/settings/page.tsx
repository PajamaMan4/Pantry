import type { Metadata } from "next";
import { getSettings } from "@/lib/db/settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "./settings-form";

// Reads the DB on every request — never statically prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings · Pantry",
};

export default function SettingsPage() {
  const settings = getSettings();

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
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
    </div>
  );
}

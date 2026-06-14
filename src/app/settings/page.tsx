import type { Metadata } from "next";
import { getSettings } from "@/lib/db/settings";
import { listLocations } from "@/lib/db/locations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "./settings-form";
import { LocationManager } from "./location-manager";

// Reads the DB on every request — never statically prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Settings · Pantry",
};

export default function SettingsPage() {
  const settings = getSettings();
  const locations = listLocations().map((l) => ({ id: l.id, name: l.name }));

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
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listBackups } from "@/lib/db/maintenance";
import { DataManager } from "./data-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Data & backups · Pantry" };

export default function DataPage() {
  const backups = listBackups();

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <Link href="/settings" className="text-sm text-muted-foreground hover:text-foreground">
        ← Settings
      </Link>
      <Card className="mt-3">
        <CardHeader>
          <CardTitle>Data &amp; backups</CardTitle>
          <CardDescription>
            Export, back up, and restore your Pantry database. Everything stays on this machine.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataManager backups={backups} />
        </CardContent>
      </Card>
    </div>
  );
}

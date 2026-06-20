"use client";

import * as React from "react";
import { DownloadIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { importInventoryFileAction } from "./actions";

const TEMPLATE = {
  pantryVersion: 1,
  items: [
    {
      name: "Ingredient name (or alias)",
      cost: 2.00,
      costUnit: "kg",
      addQuantity: 500,
      addUnit: "g",
      location: "Pantry",
      store: "Store name (optional)",
      purchasedAt: "2026-06-20",
    },
    {
      name: "Price only example",
      cost: 0.30,
      costUnit: "each",
    },
    {
      name: "Inventory only example",
      addQuantity: 2,
      addUnit: "kg",
      location: "Freezer",
    },
  ],
};

function downloadTemplate() {
  const blob = new Blob([JSON.stringify(TEMPLATE, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pantry-import-template.json";
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportInventoryDialog() {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const inputRef = React.useRef<HTMLInputElement>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      startTransition(async () => {
        let json: unknown;
        try {
          json = JSON.parse(evt.target?.result as string);
        } catch {
          setError("Could not parse file — make sure it's valid JSON.");
          return;
        }
        const result = await importInventoryFileAction(json);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        const { summary } = result;
        const parts: string[] = [];
        if (summary.pricesUpdated > 0)
          parts.push(`${summary.pricesUpdated} price${summary.pricesUpdated === 1 ? "" : "s"} updated`);
        if (summary.inventoryAdded > 0)
          parts.push(`${summary.inventoryAdded} item${summary.inventoryAdded === 1 ? "" : "s"} added to inventory`);
        if (summary.ingredientsCreated > 0)
          parts.push(`${summary.ingredientsCreated} new ingredient${summary.ingredientsCreated === 1 ? "" : "s"} created`);
        toast.success(parts.length > 0 ? parts.join(", ") : "Import complete");
        setOpen(false);
      });
    };
    reader.onerror = () => setError("Failed to read file.");
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" type="button" />}>
        <UploadIcon className="size-4" />
        Import prices / inventory
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import prices &amp; inventory</DialogTitle>
          <DialogDescription>
            Upload a JSON file to bulk-update ingredient prices and stock. Each item is
            matched by name (including aliases), and only new if nothing matches.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
            {`{ "pantryVersion": 1, "items": [`}<br />
            {`  { "name": "flour", "cost": 2.00, "costUnit": "kg",`}<br />
            {`    "addQuantity": 500, "addUnit": "g", "location": "Pantry" },`}<br />
            {`  { "name": "eggs", "cost": 0.30, "costUnit": "each" },`}<br />
            {`  { "name": "rice", "addQuantity": 2, "addUnit": "kg" }`}<br />
            {`] }`}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              <strong>cost</strong> + <strong>costUnit</strong> — unit price (e.g. $2/kg).{" "}
              <strong>addQuantity</strong> + <strong>addUnit</strong> — stock to add.{" "}
              Optional: <strong>location</strong>, <strong>store</strong>, <strong>purchasedAt</strong>.
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate} className="shrink-0">
              <DownloadIcon className="size-4" />
              Template
            </Button>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={onFileChange}
            disabled={pending}
          />
          <Button
            type="button"
            onClick={() => { setError(null); inputRef.current?.click(); }}
            disabled={pending}
          >
            <UploadIcon className="size-4" />
            {pending ? "Importing…" : "Choose JSON file"}
          </Button>

          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

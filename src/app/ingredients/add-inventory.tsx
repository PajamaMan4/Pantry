"use client";

import * as React from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { LocationOption } from "@/components/location-combobox";
import { InventoryEntryForm } from "./inventory-entry-form";

export function AddInventory({
  ingredientId,
  locations,
  defaultUnit,
  defaultLocation,
  showLocation = true,
}: {
  ingredientId: number;
  locations: LocationOption[];
  defaultUnit: string | null;
  defaultLocation: { id: number | null; name: string };
  showLocation?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-medium">Inventory</h2>
        <CollapsibleTrigger render={<Button variant="outline" size="sm" />}>
          <PlusIcon className="size-4" /> Add inventory
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="mb-2">
          <InventoryEntryForm
            ingredientId={ingredientId}
            locations={locations}
            defaultUnit={defaultUnit}
            defaultLocation={defaultLocation}
            showLocation={showLocation}
            onDone={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

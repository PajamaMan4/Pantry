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
}: {
  ingredientId: number;
  locations: LocationOption[];
  defaultUnit: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger render={<Button variant="outline" size="sm" />}>
        <PlusIcon className="size-4" /> Add inventory
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2">
          <InventoryEntryForm
            ingredientId={ingredientId}
            locations={locations}
            defaultUnit={defaultUnit}
            onDone={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { PencilIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ExpiryBadge } from "@/components/expiry-badge";
import type { LocationOption } from "@/components/location-combobox";
import { InventoryEntryForm } from "./inventory-entry-form";
import { deleteInventoryItemAction } from "./actions";

export type SerialInventoryItem = {
  id: number;
  quantity: number;
  unit: string;
  locationId: number | null;
  locationName: string | null; // display
  qtyDisplay: string;
  expiryMs: number | null;
  openedMs: number | null;
  notes: string | null;
};

function toDateInput(ms: number | null): string {
  if (ms == null) return "";
  const x = new Date(ms);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export function InventoryItemRow({
  item,
  ingredientId,
  locations,
  defaultUnit,
  nowMs,
  name,
  href,
  priceText,
  showLocation = true,
}: {
  item: SerialInventoryItem;
  ingredientId: number;
  locations: LocationOption[];
  defaultUnit: string | null;
  nowMs: number;
  name?: string;
  href?: string;
  priceText?: string;
  showLocation?: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const [deleting, startDelete] = React.useTransition();

  return (
    <Collapsible open={editing} onOpenChange={setEditing}>
      <div className="flex items-center justify-between gap-2 py-2 text-sm">
        <div className="min-w-0">
          {name && href && (
            <Link href={href} className="font-medium hover:underline">
              {name}
            </Link>
          )}
          <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
            <span className="tabular-nums text-foreground">{item.qtyDisplay}</span>
            {showLocation && <span>in {item.locationName ?? "Unsorted"}</span>}
            <ExpiryBadge expiry={item.expiryMs != null ? new Date(item.expiryMs) : null} now={new Date(nowMs)} />
          </div>
          {priceText && <div className="text-xs text-muted-foreground">{priceText}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Edit entry" onClick={() => setEditing((v) => !v)}>
            <PencilIcon className="size-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="ghost" size="icon" aria-label="Delete entry" />}>
              <TrashIcon className="size-4" />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove this stock entry?</AlertDialogTitle>
                <AlertDialogDescription>
                  Removes {item.qtyDisplay} from {item.locationName ?? "Unsorted"}. Price history is kept.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={deleting}
                  onClick={() => startDelete(async () => void (await deleteInventoryItemAction(item.id)))}
                >
                  {deleting ? "Removing…" : "Remove"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <CollapsibleContent>
        <div className="pb-2">
          <InventoryEntryForm
            ingredientId={ingredientId}
            locations={locations}
            defaultUnit={defaultUnit}
            initial={{
              id: item.id,
              quantity: String(item.quantity),
              unit: item.unit,
              locationId: item.locationId,
              locationName: item.locationName ?? "",
              expiryDate: toDateInput(item.expiryMs),
              openedDate: toDateInput(item.openedMs),
              notes: item.notes ?? "",
            }}
            onDone={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

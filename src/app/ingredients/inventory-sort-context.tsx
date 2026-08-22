"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import type { LocationOption } from "@/components/location-combobox";
import { buildTargets, LocationDropTray, type DropTarget } from "./location-drop-tray";
import type { SerialInventoryItem } from "./inventory-item-row";
import {
  createInventoryItemAction,
  deleteInventoryItemAction,
  moveInventoryItemAction,
} from "./actions";

export type HeldItem = {
  item: SerialInventoryItem;
  ingredientId: number;
  name: string;
};

type InventorySort = {
  /** The entry whose tray is open, if any. */
  heldId: number | null;
  /** Entries with a move or delete in flight — the row dims itself. */
  pendingIds: ReadonlySet<number>;
  hold: (held: HeldItem) => void;
};

const InventorySortContext = React.createContext<InventorySort | null>(null);

/**
 * Returns null when there is no provider. `InventoryItemRow` is shared with the
 * ingredient detail page, which deliberately keeps its plain behaviour — a
 * nullable context means that page needs no prop plumbing and no branch.
 */
export function useInventorySort(): InventorySort | null {
  return React.useContext(InventorySortContext);
}

export function InventorySortProvider({
  locations,
  children,
}: {
  locations: LocationOption[];
  children: React.ReactNode;
}) {
  const [held, setHeld] = React.useState<HeldItem | null>(null);
  const [pendingIds, setPendingIds] = React.useState<ReadonlySet<number>>(() => new Set());
  const [, startTransition] = React.useTransition();

  const targets = React.useMemo(() => buildTargets(locations), [locations]);

  const markPending = React.useCallback((id: number, on: boolean) => {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const restore = React.useCallback(
    ({ item, ingredientId }: HeldItem) => {
      startTransition(async () => {
        // Epoch ms round-trips through `nullableDate`'s z.coerce.date(). This
        // re-creates rather than resurrects — a new publicId is correct for the
        // tombstone model.
        const res = await createInventoryItemAction({
          ingredientId,
          name: null,
          locationId: item.locationId,
          locationName: null,
          quantity: item.quantity,
          unit: item.unit,
          expiryDate: item.expiryMs,
          openedDate: item.openedMs,
          notes: item.notes,
        });
        if (!res.ok) toast.error(res.error);
      });
    },
    [startTransition],
  );

  const hold = React.useCallback((next: HeldItem) => setHeld(next), []);
  const release = React.useCallback(() => setHeld(null), []);

  const moveTo = React.useCallback(
    (target: DropTarget) => {
      const current = held;
      release();
      if (!current) return;

      if (target.kind === "trash") {
        markPending(current.item.id, true);
        startTransition(async () => {
          await deleteInventoryItemAction(current.item.id);
          markPending(current.item.id, false);
          toast.success(`Removed ${current.item.qtyDisplay} ${current.name}`, {
            action: { label: "Undo", onClick: () => restore(current) },
            duration: 8000,
          });
        });
        return;
      }

      if (target.locationId === current.item.locationId) return; // already there
      markPending(current.item.id, true);
      startTransition(async () => {
        const res = await moveInventoryItemAction(current.item.id, target.locationId);
        markPending(current.item.id, false);
        // Success is silent on purpose — the row leaving its group is the
        // feedback, and sorting a shopping haul would otherwise be 20 toasts.
        if (!res.ok) toast.error(res.error);
      });
    },
    [held, markPending, release, restore, startTransition],
  );

  const value = React.useMemo<InventorySort>(
    () => ({ heldId: held?.item.id ?? null, pendingIds, hold }),
    [held, pendingIds, hold],
  );

  return (
    <InventorySortContext.Provider value={value}>
      {children}
      {held &&
        createPortal(
          <LocationDropTray
            targets={targets}
            heldLabel={held.name}
            heldQty={held.item.qtyDisplay}
            currentLocationId={held.item.locationId}
            onSelect={moveTo}
            onDismiss={release}
          />,
          document.body,
        )}
    </InventorySortContext.Provider>
  );
}

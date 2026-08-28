"use client";

import * as React from "react";
import { TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LocationOption } from "@/components/location-combobox";

export type DropTarget =
  | { id: string; kind: "location"; label: string; locationId: number | null }
  | { id: string; kind: "trash"; label: string };

/**
 * Every storage location is a target — including ones holding nothing, which
 * render no group in the list and are otherwise unreachable from this view.
 */
export function buildTargets(locations: LocationOption[]): DropTarget[] {
  return [
    { id: "unsorted", kind: "location", label: "Unsorted", locationId: null },
    ...locations.map(
      (l): DropTarget => ({ id: `loc-${l.id}`, kind: "location", label: l.name, locationId: l.id }),
    ),
    { id: "trash", kind: "trash", label: "Remove" },
  ];
}

/**
 * Bottom tray for re-filing one inventory entry: open it from a row's shelf
 * button, tap a location. Chips are sized for a thumb (44px) since the point of
 * this is sorting a whole shopping haul on a phone.
 */
export function LocationDropTray({
  targets,
  heldLabel,
  heldQty,
  currentLocationId,
  onSelect,
  onDismiss,
}: {
  targets: DropTarget[];
  heldLabel: string;
  heldQty: string;
  currentLocationId: number | null;
  onSelect: (target: DropTarget) => void;
  onDismiss: () => void;
}) {
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onDismiss]);

  return (
    <>
      {/* Dismiss on a *fresh* press, not click: the tap that opened the tray
          would otherwise land here as a click and close it immediately. */}
      <div className="fixed inset-0 z-40" onPointerDown={onDismiss} aria-hidden />

      <div
        role="dialog"
        aria-label={`Move ${heldLabel}`}
        className="fixed inset-x-0 bottom-0 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur"
      >
        <p className="mb-2 truncate text-xs text-muted-foreground">
          Move <span className="font-medium text-foreground">{heldLabel}</span>
          {heldQty && <span className="tabular-nums"> · {heldQty}</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {targets.map((t) => {
            const isCurrent = t.kind === "location" && t.locationId === currentLocationId;
            return (
              <Button
                key={t.id}
                type="button"
                variant={t.kind === "trash" ? "destructive" : "outline"}
                disabled={isCurrent}
                aria-current={isCurrent ? "true" : undefined}
                className={cn("h-11 px-4", isCurrent && "pointer-events-none opacity-50")}
                onClick={() => onSelect(t)}
              >
                {t.kind === "trash" && <TrashIcon className="size-4" />}
                {t.label}
              </Button>
            );
          })}
        </div>
      </div>
    </>
  );
}

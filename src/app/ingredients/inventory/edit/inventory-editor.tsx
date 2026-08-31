"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { IngredientOption } from "@/components/ingredient-combobox";
import type { LocationOption } from "@/components/location-combobox";
import {
  buildInventoryEditPayload,
  findMergePreviewKeys,
  isInventoryDraftDirty,
  locationKey,
  newLine,
  sameLocation,
  seedToLine,
  summarizeInventoryDraft,
  type DraftLine,
  type InventoryEditSeed,
} from "@/lib/domain/inventory-edit";
import { unitLabel } from "@/lib/domain/format";
import { saveInventoryEditsAction } from "@/app/ingredients/actions";
import { buildTargets, LocationDropTray } from "@/app/ingredients/location-drop-tray";
import { LocationTabs, type EditTab } from "./location-tabs";
import { InventoryEditRow, InventoryEditRowHeader, type LinePatch } from "./inventory-edit-row";

export function InventoryEditor({
  seeds,
  locations,
  allIngredients,
  showLocations = true,
}: {
  seeds: InventoryEditSeed[];
  locations: LocationOption[];
  allIngredients: IngredientOption[];
  showLocations?: boolean;
}) {
  const router = useRouter();
  const [lines, setLines] = React.useState<DraftLine[]>(() => seeds.map(seedToLine));
  const knownIngredientIds = React.useRef(new Set(allIngredients.map((i) => i.id))).current;
  const [activeTab, setActiveTab] = React.useState<number | null>(locations[0]?.id ?? null);
  const [invalidKey, setInvalidKey] = React.useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [heldKey, setHeldKey] = React.useState<string | null>(null);
  const heldLine = lines.find((l) => l.key === heldKey);

  const dirty = isInventoryDraftDirty(lines);
  const summary = summarizeInventoryDraft(lines);
  const summaryText =
    summary.edited + summary.removed + summary.added === 0
      ? "No changes yet"
      : `${summary.edited} edited · ${summary.removed} removed · ${summary.added} added`;
  const mergingKeys = React.useMemo(() => findMergePreviewKeys(lines), [lines]);

  React.useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const tabs: EditTab[] = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of lines) {
      if (l.kind === "existing" && l.deleted) continue;
      if (l.kind === "new" && l.ingredientId == null && l.amount.trim() === "") continue;
      const key = locationKey(l.locationId);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const locationTabs = locations.map((loc) => ({
      id: loc.id,
      name: loc.name,
      count: counts.get(locationKey(loc.id)) ?? 0,
    }));
    return [...locationTabs, { id: null, name: "Unsorted", count: counts.get("unsorted") ?? 0 }];
  }, [lines, locations]);

  const visibleLines = showLocations ? lines.filter((l) => sameLocation(l.locationId, activeTab)) : lines;

  function patchLine(key: string, patch: LinePatch) {
    setLines((prev) => prev.map((l) => (l.key === key ? ({ ...l, ...patch } as DraftLine) : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, newLine(showLocations ? activeTab : null, nanoid())]);
  }

  function removeLine(line: DraftLine) {
    if (line.kind === "existing") {
      patchLine(line.key, { deleted: true });
      toast(`Removed ${line.ingredientName}`);
    } else {
      setLines((prev) => prev.filter((l) => l.key !== line.key));
    }
  }

  function restoreLine(key: string) {
    patchLine(key, { deleted: false });
  }

  function onPick(
    key: string,
    picked: { id: number | null; name: string; defaultUnit: string | null },
  ) {
    // Only ever called for a NewLine (existing lines render plain text, not the picker).
    const current = lines.find((l): l is Extract<DraftLine, { kind: "new" }> => l.key === key && l.kind === "new");
    patchLine(key, {
      ingredientId: picked.id,
      ingredientName: picked.name,
      unit: current?.unit || picked.defaultUnit || "",
    });
    if (picked.id != null && !knownIngredientIds.has(picked.id)) {
      knownIngredientIds.add(picked.id);
      toast.info(`Created ingredient "${picked.name}". Stock changes still need Save changes.`);
    }
  }

  function requestCancel() {
    if (!dirty) router.push("/ingredients");
    else setDiscardOpen(true);
  }

  function save() {
    const built = buildInventoryEditPayload(lines);
    if (!built.ok) {
      if (showLocations) setActiveTab(built.locationId);
      setInvalidKey(built.key);
      toast.error(built.error);
      return;
    }
    setInvalidKey(null);
    const n = built.payload.updates.length + built.payload.deletes.length + built.payload.creates.length;
    startTransition(async () => {
      const res = await saveInventoryEditsAction(built.payload);
      if (res.ok) {
        toast.success(`Saved ${n} change${n === 1 ? "" : "s"}`);
        router.push("/ingredients");
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      {showLocations && <LocationTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />}

      <div
        role={showLocations ? "tabpanel" : undefined}
        id={showLocations ? `inv-panel-${locationKey(activeTab)}` : undefined}
        aria-labelledby={showLocations ? `inv-tab-${locationKey(activeTab)}` : undefined}
        className="space-y-3"
      >
        <InventoryEditRowHeader />

        <div className="space-y-2">
          {visibleLines.length === 0 && (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nothing here yet.
            </p>
          )}
          {visibleLines.map((line) => (
            <InventoryEditRow
              key={line.key}
              line={line}
              invalid={line.key === invalidKey}
              merging={mergingKeys.has(line.key)}
              allIngredients={allIngredients}
              onPatch={(patch) => patchLine(line.key, patch)}
              onRemove={() => removeLine(line)}
              onRestore={() => restoreLine(line.key)}
              onPick={(picked) => onPick(line.key, picked)}
              onMove={() => setHeldKey(line.key)}
              showLocation={showLocations}
            />
          ))}
        </div>

        <Button type="button" variant="outline" size="sm" onClick={addLine}>
          <PlusIcon className="size-4" /> Add line
        </Button>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background px-4 py-3">
        <FormActions extra={<span className="text-xs text-muted-foreground">{summaryText}</span>}>
          <Button type="button" variant="outline" onClick={requestCancel} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={pending || !dirty}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </FormActions>
      </div>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved inventory edits. Leaving now throws them away.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => router.push("/ingredients")}>
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {heldLine && (
        <LocationDropTray
          targets={buildTargets(locations)}
          heldLabel={heldLine.ingredientName || "new entry"}
          heldQty={[heldLine.amount, unitLabel(heldLine.unit)].filter(Boolean).join(" ")}
          currentLocationId={heldLine.locationId}
          onSelect={(t) => {
            if (t.kind === "trash") {
              removeLine(heldLine);
            } else {
              patchLine(heldLine.key, { locationId: t.locationId });
              // The row leaves the active tab, so unlike /ingredients (where it
              // just moves groups) there'd be no feedback at all without this.
              toast(`Moved ${heldLine.ingredientName || "line"} to ${t.label}`);
            }
            setHeldKey(null);
          }}
          onDismiss={() => setHeldKey(null)}
        />
      )}
    </div>
  );
}

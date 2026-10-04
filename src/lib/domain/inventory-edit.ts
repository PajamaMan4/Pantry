/**
 * Pure logic for the bulk "Inventory Edit" page (§ ingredients). The page lets
 * a user review every storage location as a tab, edit amounts/units, move or
 * remove lines, and add new ones — all in memory — then commit everything in
 * one Save. This module owns:
 *
 *  - the draft line types the client keeps in React state,
 *  - dirty-checking and a human summary of the draft,
 *  - turning a draft into a validated commit payload, and
 *  - the server-side merge/diff planner that turns that payload plus a fresh
 *    DB snapshot into concrete delete/update/insert operations.
 *
 * No I/O here — `src/lib/db/inventory.ts` executes the plan this produces.
 */

import { formatNumber } from "./format";

// ---- draft line types --------------------------------------------------------

/** What the server hands the client for a row that already exists in the DB. */
export type InventoryEditSeed = {
  id: number;
  ingredientId: number;
  ingredientName: string;
  category: string | null;
  quantity: number;
  unit: string;
  locationId: number | null;
};

/** An existing DB row under edit. `original` is frozen; the siblings are the draft. */
export type ExistingLine = {
  kind: "existing";
  key: string; // `db:${id}` — stable for the whole session
  id: number;
  ingredientId: number;
  ingredientName: string;
  /** The ingredient's category at load time, for grouping — never edited here. */
  category: string | null;
  original: { quantity: number; unit: string; locationId: number | null };
  amount: string; // string: comes straight from <input type="number">
  unit: string;
  locationId: number | null;
  deleted: boolean; // soft delete — survives undo, produces the `deletes` op
};

/** A line added in this session. Nothing exists in the DB for it yet. */
export type NewLine = {
  kind: "new";
  key: string; // nanoid()
  ingredientId: number | null; // null until the picker resolves one
  ingredientName: string;
  /** The picked ingredient's category, for grouping — null until one is picked. */
  category: string | null;
  amount: string;
  unit: string;
  locationId: number | null;
};

export type DraftLine = ExistingLine | NewLine;

export function seedToLine(seed: InventoryEditSeed): ExistingLine {
  // The stored float is the source of truth, but a raw 2.3333333333 in a
  // number input is unreadable and un-editable. Round the draft *and* its
  // dirty-check baseline together so a rounded row doesn't read as edited.
  const amount = formatNumber(seed.quantity);
  return {
    kind: "existing",
    key: `db:${seed.id}`,
    id: seed.id,
    ingredientId: seed.ingredientId,
    ingredientName: seed.ingredientName,
    category: seed.category,
    original: { quantity: Number(amount), unit: seed.unit, locationId: seed.locationId },
    amount,
    unit: seed.unit,
    locationId: seed.locationId,
    deleted: false,
  };
}

export function newLine(locationId: number | null, key: string): NewLine {
  return { kind: "new", key, ingredientId: null, ingredientName: "", category: null, amount: "", unit: "", locationId };
}

export function isBlankNewLine(l: NewLine): boolean {
  return l.ingredientId == null && l.ingredientName.trim() === "" && l.amount.trim() === "";
}

// ---- location helpers ---------------------------------------------------------

/** Normalizes null/undefined so `Unsorted` (null) always compares equal to itself. */
export const sameLocation = (a: number | null, b: number | null): boolean => (a ?? null) === (b ?? null);

export const locationKey = (id: number | null): string => (id == null ? "unsorted" : `loc:${id}`);

// ---- dirty check + summary ------------------------------------------------------

export function isInventoryDraftDirty(lines: DraftLine[]): boolean {
  return lines.some((l) => {
    if (l.kind === "existing") {
      return (
        l.deleted ||
        l.amount.trim() !== String(l.original.quantity) ||
        l.unit !== l.original.unit ||
        !sameLocation(l.locationId, l.original.locationId)
      );
    }
    return !isBlankNewLine(l);
  });
}

export function summarizeInventoryDraft(lines: DraftLine[]): { edited: number; removed: number; added: number } {
  let edited = 0;
  let removed = 0;
  let added = 0;
  for (const l of lines) {
    if (l.kind === "existing") {
      if (l.deleted) {
        removed++;
      } else if (
        l.amount.trim() !== String(l.original.quantity) ||
        l.unit !== l.original.unit ||
        !sameLocation(l.locationId, l.original.locationId)
      ) {
        edited++;
      }
    } else if (!isBlankNewLine(l)) {
      added++;
    }
  }
  return { edited, removed, added };
}

/**
 * Keys of lines whose (ingredientId, locationId, unit) collides with another
 * visible line — either an existing row or an earlier new line — so the UI can
 * hint "merges with an existing line on save" without doing the matching inline.
 * Deleted existing lines are excluded: they won't be there to merge into.
 */
export function findMergePreviewKeys(lines: DraftLine[]): Set<string> {
  const seen = new Map<string, string>(); // signature -> first key seen
  const result = new Set<string>();
  for (const l of lines) {
    if (l.kind === "existing" && l.deleted) continue;
    if (l.kind === "new" && isBlankNewLine(l)) continue;
    if (l.ingredientId == null || !l.unit) continue;
    const sig = `${l.ingredientId}|${locationKey(l.locationId)}|${l.unit}`;
    const firstKey = seen.get(sig);
    if (firstKey) {
      result.add(firstKey);
      result.add(l.key);
    } else {
      seen.set(sig, l.key);
    }
  }
  return result;
}

// ---- commit payload -------------------------------------------------------------

export type InventoryEditPayload = {
  updates: { id: number; quantity: number; unit: string; locationId: number | null }[];
  deletes: number[];
  creates: { ingredientId: number; quantity: number; unit: string; locationId: number | null }[];
};

export type BuildInventoryEditResult =
  | { ok: true; payload: InventoryEditPayload }
  | { ok: false; error: string; key: string; locationId: number | null };

/**
 * Validates every draft line and turns it into a commit payload. Returns the
 * first validation failure it finds (with the offending line's key + location
 * so the UI can jump to it), rather than collecting all errors — a bulk editor
 * with many rows is easier to work through one problem at a time.
 */
export function buildInventoryEditPayload(lines: DraftLine[]): BuildInventoryEditResult {
  const updates: InventoryEditPayload["updates"] = [];
  const deletes: number[] = [];
  const creates: InventoryEditPayload["creates"] = [];

  for (const l of lines) {
    if (l.kind === "existing") {
      if (l.deleted) {
        deletes.push(l.id);
        continue;
      }
      const amountTrim = l.amount.trim();
      if (amountTrim === "") {
        return { ok: false, error: `Enter an amount for ${l.ingredientName}.`, key: l.key, locationId: l.locationId };
      }
      const quantity = Number(amountTrim);
      if (!Number.isFinite(quantity)) {
        return {
          ok: false,
          error: `Amount for ${l.ingredientName} isn't a number.`,
          key: l.key,
          locationId: l.locationId,
        };
      }
      if (quantity < 0) {
        return { ok: false, error: "Amount can't be negative.", key: l.key, locationId: l.locationId };
      }
      const unchanged =
        amountTrim === String(l.original.quantity) &&
        l.unit === l.original.unit &&
        sameLocation(l.locationId, l.original.locationId);
      if (!unchanged) {
        updates.push({ id: l.id, quantity, unit: l.unit, locationId: l.locationId });
      }
      continue;
    }

    // New line.
    if (isBlankNewLine(l)) continue; // silently ignored, like the Add Inventory page

    if (l.ingredientId == null) {
      return {
        ok: false,
        error: `Pick an ingredient for "${l.ingredientName.trim() || "new line"}".`,
        key: l.key,
        locationId: l.locationId,
      };
    }
    const amountTrim = l.amount.trim();
    if (amountTrim === "") {
      return {
        ok: false,
        error: `Enter an amount for ${l.ingredientName || "the new line"}.`,
        key: l.key,
        locationId: l.locationId,
      };
    }
    const quantity = Number(amountTrim);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return {
        ok: false,
        error: `Amount for ${l.ingredientName || "the new line"} must be greater than 0.`,
        key: l.key,
        locationId: l.locationId,
      };
    }
    if (!l.unit) {
      return {
        ok: false,
        error: `Pick a unit for ${l.ingredientName || "the new line"}.`,
        key: l.key,
        locationId: l.locationId,
      };
    }
    creates.push({ ingredientId: l.ingredientId, quantity, unit: l.unit, locationId: l.locationId });
  }

  return { ok: true, payload: { updates, deletes, creates } };
}

// ---- server-side merge/diff planner -----------------------------------------------

export type InventorySnapshotRow = {
  id: number;
  ingredientId: number;
  locationId: number | null;
  quantity: number;
  unit: string;
};

export type InventoryEditPlan = {
  deletes: number[];
  updates: { id: number; quantity: number; unit: string; locationId: number | null }[];
  inserts: { ingredientId: number; locationId: number | null; quantity: number; unit: string }[];
  merged: number;
};

type ProjectedRow = InventorySnapshotRow & { dirty: boolean };

/**
 * Turns a commit payload plus a fresh DB snapshot into concrete write
 * operations, honouring the "new line merges into an existing line with the
 * same ingredient+location+unit" rule (matching `logPurchase` /
 * `importPricesAndInventory`) while never letting a create clobber an edit
 * made in the same batch.
 *
 * Order matters:
 *  1. Deletes apply first, so a delete-then-re-add produces a fresh insert,
 *     never a merge into a row about to disappear.
 *  2. Updates apply second (delete wins over an update to the same id), so a
 *     create merging into an edited row folds into the *edited* values.
 *  3. Creates apply last, matching first against the projected (post-update)
 *     rows, then against inserts already produced earlier in this same batch.
 *
 * `conflicts` holds update ids that don't exist in the snapshot (already
 * deleted elsewhere) — the caller should abort the whole transaction rather
 * than apply a partial edit.
 */
export function planInventoryEdit(
  snapshot: InventorySnapshotRow[],
  payload: InventoryEditPayload,
): { plan: InventoryEditPlan; conflicts: number[] } {
  const conflicts: number[] = [];
  const projected = new Map<number, ProjectedRow>();
  for (const row of snapshot) projected.set(row.id, { ...row, dirty: false });

  // 1. Deletes.
  const deleteSet = new Set<number>();
  for (const id of payload.deletes) {
    if (projected.has(id)) {
      deleteSet.add(id);
      projected.delete(id);
    }
    // Ids absent from the snapshot are already gone — idempotent, no conflict.
  }

  // 2. Updates (delete wins; unknown id -> conflict).
  for (const u of payload.updates) {
    if (deleteSet.has(u.id)) continue;
    const row = projected.get(u.id);
    if (!row) {
      conflicts.push(u.id);
      continue;
    }
    const changed = row.quantity !== u.quantity || row.unit !== u.unit || !sameLocation(row.locationId, u.locationId);
    if (changed) {
      row.quantity = u.quantity;
      row.unit = u.unit;
      row.locationId = u.locationId;
      row.dirty = true;
    }
  }

  if (conflicts.length > 0) {
    // Emitting a plan alongside conflicts would tempt a caller into applying it
    // partially; keep the contract simple and let the caller bail out.
    return { plan: { deletes: [], updates: [], inserts: [], merged: 0 }, conflicts };
  }

  // 3. Creates: merge into a projected row first (lowest id wins, deterministic),
  //    else into a pending insert from earlier in this batch, else append.
  const pendingInserts: { ingredientId: number; locationId: number | null; quantity: number; unit: string }[] = [];
  let merged = 0;
  const projectedRows = () => [...projected.values()].sort((a, b) => a.id - b.id);

  for (const c of payload.creates) {
    const target = projectedRows().find(
      (r) => r.ingredientId === c.ingredientId && r.unit === c.unit && sameLocation(r.locationId, c.locationId),
    );
    if (target) {
      target.quantity += c.quantity;
      target.dirty = true;
      merged++;
      continue;
    }
    const pending = pendingInserts.find(
      (r) => r.ingredientId === c.ingredientId && r.unit === c.unit && sameLocation(r.locationId, c.locationId),
    );
    if (pending) {
      pending.quantity += c.quantity;
      merged++;
      continue;
    }
    pendingInserts.push({ ingredientId: c.ingredientId, locationId: c.locationId, quantity: c.quantity, unit: c.unit });
  }

  const updates = projectedRows()
    .filter((r) => r.dirty)
    .map((r) => ({ id: r.id, quantity: r.quantity, unit: r.unit, locationId: r.locationId }));

  return {
    plan: { deletes: [...deleteSet], updates, inserts: pendingInserts, merged },
    conflicts: [],
  };
}

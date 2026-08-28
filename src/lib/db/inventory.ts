import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import {
  inventoryItems,
  ingredients,
  ingredientAliases,
  storageLocations,
  priceEntries,
  type InventoryItem,
  type Ingredient,
  type StorageLocation,
} from "./schema";
import { recordTombstone, recordTombstones } from "./tombstones";
import {
  planInventoryEdit,
  type InventoryEditPayload,
  type InventorySnapshotRow,
} from "../domain/inventory-edit";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type InventoryRow = {
  item: InventoryItem;
  ingredient: Pick<Ingredient, "id" | "name" | "defaultUnit" | "category" | "density" | "gramsPerEach">;
  location: StorageLocation | null;
};

type IngredientRef = { ingredientId: number | null; name?: string | null };
type LocationRef = { locationId: number | null; locationName?: string | null };

export type InventoryItemInput = IngredientRef &
  LocationRef & {
    quantity: number;
    unit: string;
    expiryDate: Date | null;
    openedDate: Date | null;
    notes: string | null;
  };

export type LogPurchaseInput = IngredientRef &
  LocationRef & {
    quantity: number;
    unit: string;
    price: number;
    store: string | null;
    purchasedAt: Date;
    expiryDate: Date | null;
  };

// ---- helpers ----------------------------------------------------------------
function resolveIngredientId(tx: Tx, ref: IngredientRef, defaultUnit?: string | null): number {
  if (ref.ingredientId != null) return ref.ingredientId;
  const name = (ref.name ?? "").trim();
  if (!name) throw new Error("Inventory item is missing both an ingredient id and a name.");
  // 1. Exact canonical name match (case-insensitive)
  const byName = tx
    .select({ id: ingredients.id })
    .from(ingredients)
    .where(sql`lower(${ingredients.name}) = lower(${name})`)
    .get();
  if (byName) return byName.id;
  // 2. Alias match (case-insensitive)
  const byAlias = tx
    .select({ ingredientId: ingredientAliases.ingredientId })
    .from(ingredientAliases)
    .where(sql`lower(${ingredientAliases.alias}) = lower(${name})`)
    .get();
  if (byAlias) return byAlias.ingredientId;
  // 3. Create new ingredient
  return tx
    .insert(ingredients)
    .values({ name, defaultUnit: defaultUnit ?? null })
    .returning({ id: ingredients.id })
    .get().id;
}

function resolveLocationId(tx: Tx, ref: LocationRef): number | null {
  if (ref.locationId != null) return ref.locationId;
  const name = (ref.locationName ?? "").trim();
  if (!name) return null;
  const existing = tx
    .select({ id: storageLocations.id })
    .from(storageLocations)
    .where(sql`lower(${storageLocations.name}) = lower(${name})`)
    .get();
  if (existing) return existing.id;
  const max = tx.select({ m: sql<number>`coalesce(max(${storageLocations.sortOrder}), -1)` }).from(storageLocations).get();
  return tx.insert(storageLocations).values({ name, sortOrder: (max?.m ?? -1) + 1 }).returning({ id: storageLocations.id }).get().id;
}

function rowSelect() {
  return db
    .select({ item: inventoryItems, ing: ingredients, loc: storageLocations })
    .from(inventoryItems)
    .innerJoin(ingredients, eq(inventoryItems.ingredientId, ingredients.id))
    .leftJoin(storageLocations, eq(inventoryItems.locationId, storageLocations.id));
}

function toRow(r: { item: InventoryItem; ing: Ingredient; loc: StorageLocation | null }): InventoryRow {
  return {
    item: r.item,
    ingredient: {
      id: r.ing.id,
      name: r.ing.name,
      defaultUnit: r.ing.defaultUnit,
      category: r.ing.category,
      density: r.ing.density,
      gramsPerEach: r.ing.gramsPerEach,
    },
    location: r.loc ?? null,
  };
}

// ---- queries ----------------------------------------------------------------
export function listInventory(): InventoryRow[] {
  return rowSelect().orderBy(asc(ingredients.name)).all().map(toRow);
}

export function getInventoryItem(id: number): InventoryRow | undefined {
  const r = rowSelect().where(eq(inventoryItems.id, id)).get();
  return r ? toRow(r) : undefined;
}

export function listInventoryForIngredient(
  ingredientId: number,
): { item: InventoryItem; location: StorageLocation | null }[] {
  return db
    .select({ item: inventoryItems, loc: storageLocations })
    .from(inventoryItems)
    .leftJoin(storageLocations, eq(inventoryItems.locationId, storageLocations.id))
    .where(eq(inventoryItems.ingredientId, ingredientId))
    .all()
    .map((r) => ({ item: r.item, location: r.loc ?? null }));
}

// ---- mutations --------------------------------------------------------------
export function createInventoryItem(input: InventoryItemInput): number {
  return db.transaction((tx) => {
    const ingredientId = resolveIngredientId(tx, input, input.unit);
    const locationId = resolveLocationId(tx, input);
    return tx
      .insert(inventoryItems)
      .values({
        ingredientId,
        locationId,
        quantity: input.quantity,
        unit: input.unit,
        expiryDate: input.expiryDate,
        openedDate: input.openedDate,
        notes: input.notes,
      })
      .returning({ id: inventoryItems.id })
      .get().id;
  });
}

export function updateInventoryItem(id: number, input: InventoryItemInput): void {
  db.transaction((tx) => {
    const ingredientId = resolveIngredientId(tx, input, input.unit);
    const locationId = resolveLocationId(tx, input);
    tx.update(inventoryItems)
      .set({
        ingredientId,
        locationId,
        quantity: input.quantity,
        unit: input.unit,
        expiryDate: input.expiryDate,
        openedDate: input.openedDate,
        notes: input.notes,
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, id))
      .run();
  });
}

/**
 * Move an entry to another storage location (null = Unsorted). Narrow on
 * purpose: `updateInventoryItem` rewrites every column, so using it to change
 * only the location means round-tripping quantity/unit/dates/notes.
 */
export function setInventoryLocation(id: number, locationId: number | null): void {
  db.update(inventoryItems)
    .set({ locationId, updatedAt: new Date() })
    .where(eq(inventoryItems.id, id))
    .run();
}

export function deleteInventoryItem(id: number): void {
  db.transaction((tx) => {
    const row = tx
      .select({ publicId: inventoryItems.publicId })
      .from(inventoryItems)
      .where(eq(inventoryItems.id, id))
      .get();
    tx.delete(inventoryItems).where(eq(inventoryItems.id, id)).run();
    if (row) recordTombstone(tx, "inventory_item", row.publicId);
  });
}

/**
 * Bulk draw-down: decrement specific inventory rows by an amount (in each row's
 * own unit). A row that reaches zero or below is deleted (and tombstoned).
 * Rows that no longer exist are skipped. Runs in one transaction.
 */
export function decrementInventoryItems(
  items: { inventoryItemId: number; amount: number }[],
): void {
  db.transaction((tx) => {
    for (const { inventoryItemId, amount } of items) {
      const row = tx
        .select({ id: inventoryItems.id, quantity: inventoryItems.quantity, publicId: inventoryItems.publicId })
        .from(inventoryItems)
        .where(eq(inventoryItems.id, inventoryItemId))
        .get();
      if (!row) continue;
      const remaining = row.quantity - amount;
      if (remaining <= 0) {
        tx.delete(inventoryItems).where(eq(inventoryItems.id, row.id)).run();
        recordTombstone(tx, "inventory_item", row.publicId);
      } else {
        tx.update(inventoryItems)
          .set({ quantity: remaining, updatedAt: new Date() })
          .where(eq(inventoryItems.id, row.id))
          .run();
      }
    }
  });
}

/** Clear all stored stock for an ingredient (alphabetical-view "remove from stock"). */
export function clearInventoryForIngredient(ingredientId: number): void {
  db.transaction((tx) => {
    const ids = tx
      .select({ publicId: inventoryItems.publicId })
      .from(inventoryItems)
      .where(eq(inventoryItems.ingredientId, ingredientId))
      .all()
      .map((r) => r.publicId);
    tx.delete(inventoryItems).where(eq(inventoryItems.ingredientId, ingredientId)).run();
    recordTombstones(tx, "inventory_item", ids);
  });
}

/** All inventory rows grouped by ingredient id (for the alphabetical list view). */
export function inventoryByIngredient(): Map<number, InventoryRow[]> {
  const map = new Map<number, InventoryRow[]>();
  for (const row of listInventory()) {
    const arr = map.get(row.ingredient.id) ?? [];
    arr.push(row);
    map.set(row.ingredient.id, arr);
  }
  return map;
}

/**
 * The "I just got back from the store" action (§3.4): in one transaction, add
 * stock AND record the price paid. Stock merges into an existing row with the
 * same ingredient + location + unit; otherwise a new row is created.
 */
export function logPurchase(input: LogPurchaseInput): { inventoryItemId: number; priceEntryId: number } {
  return db.transaction((tx) => {
    const ingredientId = resolveIngredientId(tx, input, input.unit);
    const locationId = resolveLocationId(tx, input);

    const existing = tx
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.ingredientId, ingredientId),
          locationId == null
            ? sql`${inventoryItems.locationId} is null`
            : eq(inventoryItems.locationId, locationId),
          eq(inventoryItems.unit, input.unit),
        ),
      )
      .get();

    let inventoryItemId: number;
    if (existing) {
      tx.update(inventoryItems)
        .set({
          quantity: existing.quantity + input.quantity,
          expiryDate: input.expiryDate ?? existing.expiryDate,
          updatedAt: new Date(),
        })
        .where(eq(inventoryItems.id, existing.id))
        .run();
      inventoryItemId = existing.id;
    } else {
      inventoryItemId = tx
        .insert(inventoryItems)
        .values({
          ingredientId,
          locationId,
          quantity: input.quantity,
          unit: input.unit,
          expiryDate: input.expiryDate,
        })
        .returning({ id: inventoryItems.id })
        .get().id;
    }

    const priceEntryId = tx
      .insert(priceEntries)
      .values({
        ingredientId,
        price: input.price,
        quantity: input.quantity,
        unit: input.unit,
        store: input.store,
        purchasedAt: input.purchasedAt,
      })
      .returning({ id: priceEntries.id })
      .get().id;

    return { inventoryItemId, priceEntryId };
  });
}

export type BulkImportItem = {
  name: string;
  // Price fields (at least one of price/addQuantity must be present)
  cost?: number | null;
  costUnit?: string | null;
  costQuantity?: number | null;
  store?: string | null;
  purchasedAt?: Date | null;
  // Inventory fields
  addQuantity?: number | null;
  addUnit?: string | null;
  location?: string | null;
};

export type BulkImportSummary = {
  itemsProcessed: number;
  pricesUpdated: number;
  inventoryAdded: number;
  ingredientsCreated: number;
};

/**
 * Bulk-import prices and/or inventory from a validated item list. Runs in a
 * single transaction so a failure leaves data untouched.
 * - Price: stored as a price entry with quantity=1 (unit price model).
 * - Inventory: merged into an existing row with the same ingredient+location+unit,
 *   or a new row is created (same behaviour as logPurchase).
 */
export function importPricesAndInventory(items: BulkImportItem[]): BulkImportSummary {
  return db.transaction((tx) => {
    let pricesUpdated = 0;
    let inventoryAdded = 0;
    let ingredientsCreated = 0;

    for (const item of items) {
      const defaultUnit = item.costUnit ?? item.addUnit ?? null;

      // Track whether this name resolved to a pre-existing ingredient.
      const beforeCount = tx
        .select({ id: ingredients.id })
        .from(ingredients)
        .where(sql`lower(${ingredients.name}) = lower(${item.name.trim()})`)
        .get();
      const aliasBefore = beforeCount
        ? null
        : tx
            .select({ ingredientId: ingredientAliases.ingredientId })
            .from(ingredientAliases)
            .where(sql`lower(${ingredientAliases.alias}) = lower(${item.name.trim()})`)
            .get();
      const isNew = !beforeCount && !aliasBefore;

      const ingredientId = resolveIngredientId(
        tx,
        { ingredientId: null, name: item.name },
        defaultUnit,
      );

      if (isNew) ingredientsCreated++;

      if (item.cost != null && item.costUnit) {
        tx.insert(priceEntries)
          .values({
            ingredientId,
            price: item.cost,
            quantity: item.costQuantity ?? 1,
            unit: item.costUnit,
            store: item.store ?? null,
            purchasedAt: item.purchasedAt ?? new Date(),
          })
          .run();
        pricesUpdated++;
      }

      if (item.addQuantity != null && item.addUnit) {
        const locationRef: LocationRef = { locationId: null, locationName: item.location ?? null };
        const locationId = resolveLocationId(tx, locationRef);

        const existing = tx
          .select()
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.ingredientId, ingredientId),
              locationId == null
                ? sql`${inventoryItems.locationId} is null`
                : eq(inventoryItems.locationId, locationId),
              eq(inventoryItems.unit, item.addUnit),
            ),
          )
          .get();

        if (existing) {
          tx.update(inventoryItems)
            .set({ quantity: existing.quantity + item.addQuantity, updatedAt: new Date() })
            .where(eq(inventoryItems.id, existing.id))
            .run();
        } else {
          tx.insert(inventoryItems)
            .values({ ingredientId, locationId, quantity: item.addQuantity, unit: item.addUnit })
            .run();
        }
        inventoryAdded++;
      }
    }

    return { itemsProcessed: items.length, pricesUpdated, inventoryAdded, ingredientsCreated };
  });
}

export type InventoryEditSummary = { updated: number; deleted: number; created: number; merged: number };

/**
 * Apply a whole Inventory Edit page session in ONE transaction: deletes
 * (tombstoned), quantity/unit/location updates, and new rows — with new rows
 * merging into an existing row of the same ingredient+location+unit (same rule
 * as `logPurchase` / `importPricesAndInventory`). The diff/merge logic itself
 * lives in `planInventoryEdit` (src/lib/domain/inventory-edit.ts) so it stays
 * pure and unit-tested; this function only loads a snapshot, runs the planner,
 * and executes the result. Updates deliberately touch only quantity, unit,
 * locationId and updatedAt — expiryDate / openedDate / notes are preserved.
 */
export function applyInventoryEdits(payload: InventoryEditPayload): InventoryEditSummary {
  return db.transaction((tx) => {
    // Guard: a location referenced by an update/create may have been deleted
    // out from under an open editor tab.
    const locationIds = new Set<number>();
    for (const u of payload.updates) if (u.locationId != null) locationIds.add(u.locationId);
    for (const c of payload.creates) if (c.locationId != null) locationIds.add(c.locationId);
    if (locationIds.size > 0) {
      const found = tx
        .select({ id: storageLocations.id })
        .from(storageLocations)
        .where(inArray(storageLocations.id, [...locationIds]))
        .all();
      if (found.length !== locationIds.size) {
        throw new Error("That location no longer exists.");
      }
    }

    // Snapshot every row the payload could touch: rows referenced directly
    // (updates + deletes) plus every row for an ingredient a create might
    // merge into (which can live in a different location than the create).
    const touchedIds = [...new Set([...payload.updates.map((u) => u.id), ...payload.deletes])];
    const createIngredientIds = [...new Set(payload.creates.map((c) => c.ingredientId))];

    const snapshotMap = new Map<number, InventorySnapshotRow>();
    if (touchedIds.length > 0) {
      for (const r of tx.select().from(inventoryItems).where(inArray(inventoryItems.id, touchedIds)).all()) {
        snapshotMap.set(r.id, { id: r.id, ingredientId: r.ingredientId, locationId: r.locationId, quantity: r.quantity, unit: r.unit });
      }
    }
    if (createIngredientIds.length > 0) {
      for (const r of tx
        .select()
        .from(inventoryItems)
        .where(inArray(inventoryItems.ingredientId, createIngredientIds))
        .all()) {
        snapshotMap.set(r.id, { id: r.id, ingredientId: r.ingredientId, locationId: r.locationId, quantity: r.quantity, unit: r.unit });
      }
    }

    const { plan, conflicts } = planInventoryEdit([...snapshotMap.values()], payload);
    if (conflicts.length > 0) {
      throw new Error("Some inventory lines changed elsewhere. Reload the page and try again.");
    }

    if (plan.deletes.length > 0) {
      // InventorySnapshotRow doesn't carry publicId, so fetch it fresh before deleting.
      const rows = tx
        .select({ id: inventoryItems.id, publicId: inventoryItems.publicId })
        .from(inventoryItems)
        .where(inArray(inventoryItems.id, plan.deletes))
        .all();
      tx.delete(inventoryItems).where(inArray(inventoryItems.id, plan.deletes)).run();
      recordTombstones(
        tx,
        "inventory_item",
        rows.map((r) => r.publicId),
      );
    }

    for (const u of plan.updates) {
      tx.update(inventoryItems)
        .set({ quantity: u.quantity, unit: u.unit, locationId: u.locationId, updatedAt: new Date() })
        .where(eq(inventoryItems.id, u.id))
        .run();
    }

    if (plan.inserts.length > 0) {
      tx.insert(inventoryItems)
        .values(
          plan.inserts.map((i) => ({
            ingredientId: i.ingredientId,
            locationId: i.locationId,
            quantity: i.quantity,
            unit: i.unit,
          })),
        )
        .run();
    }

    return {
      updated: plan.updates.length,
      deleted: plan.deletes.length,
      created: plan.inserts.length,
      merged: plan.merged,
    };
  });
}

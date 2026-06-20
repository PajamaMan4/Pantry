import { and, asc, eq, sql } from "drizzle-orm";
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

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type InventoryRow = {
  item: InventoryItem;
  ingredient: Pick<Ingredient, "id" | "name" | "defaultUnit" | "category" | "density">;
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

export function deleteInventoryItem(id: number): void {
  db.delete(inventoryItems).where(eq(inventoryItems.id, id)).run();
}

/** Clear all stored stock for an ingredient (alphabetical-view "remove from stock"). */
export function clearInventoryForIngredient(ingredientId: number): void {
  db.delete(inventoryItems).where(eq(inventoryItems.ingredientId, ingredientId)).run();
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
            quantity: 1,
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

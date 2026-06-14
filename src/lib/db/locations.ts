import { asc, eq, sql } from "drizzle-orm";
import { db } from "./client";
import { storageLocations, inventoryItems, type StorageLocation } from "./schema";

export function listLocations(): StorageLocation[] {
  return db
    .select()
    .from(storageLocations)
    .orderBy(asc(storageLocations.sortOrder), asc(storageLocations.name))
    .all();
}

export function createLocation(name: string): StorageLocation {
  return getOrCreateLocation(name);
}

export function renameLocation(id: number, name: string): StorageLocation {
  return db
    .update(storageLocations)
    .set({ name: name.trim() })
    .where(eq(storageLocations.id, id))
    .returning()
    .get();
}

/** Delete a location, first disassociating it from any inventory items (§ settings). */
export function deleteLocation(id: number): void {
  db.transaction((tx) => {
    tx.update(inventoryItems)
      .set({ locationId: null, updatedAt: new Date() })
      .where(eq(inventoryItems.locationId, id))
      .run();
    tx.delete(storageLocations).where(eq(storageLocations.id, id)).run();
  });
}

export function getOrCreateLocation(name: string): StorageLocation {
  const n = name.trim();
  const existing = db
    .select()
    .from(storageLocations)
    .where(sql`lower(${storageLocations.name}) = lower(${n})`)
    .get();
  if (existing) return existing;

  const max = db
    .select({ m: sql<number>`coalesce(max(${storageLocations.sortOrder}), -1)` })
    .from(storageLocations)
    .get();
  return db
    .insert(storageLocations)
    .values({ name: n, sortOrder: (max?.m ?? -1) + 1 })
    .returning()
    .get();
}

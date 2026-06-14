import { asc, sql } from "drizzle-orm";
import { db } from "./client";
import { storageLocations, type StorageLocation } from "./schema";

export function listLocations(): StorageLocation[] {
  return db
    .select()
    .from(storageLocations)
    .orderBy(asc(storageLocations.sortOrder), asc(storageLocations.name))
    .all();
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

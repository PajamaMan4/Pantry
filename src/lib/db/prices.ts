import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "./client";
import { priceEntries, type PriceEntry } from "./schema";
import { recordTombstone } from "./tombstones";

export type PriceEntryInput = {
  ingredientId: number;
  price: number;
  quantity: number;
  unit: string;
  store: string | null;
  purchasedAt: Date;
};

export function listPriceEntries(ingredientId: number): PriceEntry[] {
  return db
    .select()
    .from(priceEntries)
    .where(eq(priceEntries.ingredientId, ingredientId))
    .orderBy(desc(priceEntries.purchasedAt))
    .all();
}

/** Price entries for many ingredients at once (avoids N+1 on the inventory list). */
export function listPriceEntriesFor(ids: number[]): Map<number, PriceEntry[]> {
  const map = new Map<number, PriceEntry[]>();
  if (ids.length === 0) return map;
  const rows = db
    .select()
    .from(priceEntries)
    .where(inArray(priceEntries.ingredientId, ids))
    .orderBy(asc(priceEntries.purchasedAt))
    .all();
  for (const r of rows) {
    const arr = map.get(r.ingredientId) ?? [];
    arr.push(r);
    map.set(r.ingredientId, arr);
  }
  return map;
}

export function createPriceEntry(input: PriceEntryInput): number {
  return db
    .insert(priceEntries)
    .values(input)
    .returning({ id: priceEntries.id })
    .get().id;
}

export function deletePriceEntry(id: number): void {
  db.transaction((tx) => {
    const row = tx
      .select({ publicId: priceEntries.publicId })
      .from(priceEntries)
      .where(eq(priceEntries.id, id))
      .get();
    tx.delete(priceEntries).where(eq(priceEntries.id, id)).run();
    if (row) recordTombstone(tx, "price_entry", row.publicId);
  });
}

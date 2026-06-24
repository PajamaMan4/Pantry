import { db } from "./client";
import { tombstones } from "./schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The kinds of row a deletion can be recorded against. Only entities that carry
 * their own `publicId` are tombstoned; aggregate children (recipe_ingredients,
 * recipe_tags, cook_log_lines) travel with their parent and are never recorded
 * here. See pantry-mobile-sync-feasibility.md §7 and the sync-enabler plan.
 */
export type TombstoneEntity =
  | "recipe"
  | "recipe_group"
  | "ingredient"
  | "ingredient_alias"
  | "inventory_item"
  | "price_entry"
  | "cook_log"
  | "shopping_list_item"
  | "storage_location"
  | "tag";

/**
 * Record that a row was deleted so a future sync can propagate the removal to a
 * peer (a hard delete otherwise leaves no trace and the row reappears on the next
 * sync). Must run inside the same transaction as the delete so the two are atomic.
 */
export function recordTombstone(tx: Tx, entity: TombstoneEntity, publicId: string): void {
  tx.insert(tombstones).values({ entity, publicId }).run();
}

/** Bulk variant for delete sites that remove many rows at once. No-op when empty. */
export function recordTombstones(tx: Tx, entity: TombstoneEntity, publicIds: string[]): void {
  if (publicIds.length === 0) return;
  tx.insert(tombstones)
    .values(publicIds.map((publicId) => ({ entity, publicId })))
    .run();
}

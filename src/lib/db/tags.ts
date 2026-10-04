import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import { recipes, recipeTags, tags, type Tag } from "./schema";
import { recordTombstone } from "./tombstones";

export function listTags(): Tag[] {
  return db.select().from(tags).orderBy(asc(tags.name)).all();
}

export type TagWithCount = { id: number; name: string; count: number };

/** Every tag with the number of recipes carrying it (0 for an unused tag). */
export function listTagsWithCounts(): TagWithCount[] {
  return db
    .select({
      id: tags.id,
      name: tags.name,
      count: sql<number>`count(distinct ${recipeTags.recipeId})`,
    })
    .from(tags)
    .leftJoin(recipeTags, eq(recipeTags.tagId, tags.id))
    .groupBy(tags.id)
    .orderBy(asc(tags.name))
    .all();
}

/** Get an existing tag by case-insensitive name, or create it. */
export function getOrCreateTag(name: string): Tag {
  const n = name.trim();
  const existing = findTagByName(n);
  if (existing) return existing;
  return db.insert(tags).values({ name: n }).returning().get();
}

/** Case-insensitive lookup, for collision checks. */
export function findTagByName(name: string): Tag | undefined {
  return db
    .select()
    .from(tags)
    .where(sql`lower(${tags.name}) = lower(${name.trim()})`)
    .get();
}

export function renameTag(id: number, name: string): Tag {
  return db
    .update(tags)
    .set({ name: name.trim(), updatedAt: new Date() })
    .where(eq(tags.id, id))
    .returning()
    .get();
}

function recipeIdsWithTag(tx: Pick<typeof db, "select">, tagId: number): number[] {
  const rows = tx
    .select({ recipeId: recipeTags.recipeId })
    .from(recipeTags)
    .where(eq(recipeTags.tagId, tagId))
    .all();
  return [...new Set(rows.map((r) => r.recipeId))];
}

function touchRecipes(tx: Pick<typeof db, "update">, recipeIds: number[]): void {
  if (recipeIds.length === 0) return;
  tx.update(recipes).set({ updatedAt: new Date() }).where(inArray(recipes.id, recipeIds)).run();
}

/** Delete a tag; its `recipe_tags` rows cascade, the recipes themselves are kept. */
export function deleteTag(id: number): void {
  db.transaction((tx) => {
    const row = tx.select({ publicId: tags.publicId }).from(tags).where(eq(tags.id, id)).get();
    if (!row) return;
    touchRecipes(tx, recipeIdsWithTag(tx, id));
    tx.delete(tags).where(eq(tags.id, id)).run();
    recordTombstone(tx, "tag", row.publicId);
  });
}

/**
 * Retag every recipe carrying `sourceId` with `targetId`, then delete the source
 * tag. Recipes already carrying both end up with just the target (`recipe_tags`
 * has no unique constraint, so duplicates are avoided here). Returns how many
 * recipes carried the source.
 */
export function mergeTag(sourceId: number, targetId: number): number {
  if (sourceId === targetId) return 0;
  return db.transaction((tx) => {
    const source = tx.select({ publicId: tags.publicId }).from(tags).where(eq(tags.id, sourceId)).get();
    const target = tx.select({ id: tags.id }).from(tags).where(eq(tags.id, targetId)).get();
    if (!source || !target) return 0;

    const affected = recipeIdsWithTag(tx, sourceId);
    const alreadyTargeted = new Set(recipeIdsWithTag(tx, targetId));
    const toRetag = affected.filter((rid) => !alreadyTargeted.has(rid));
    if (toRetag.length > 0) {
      tx.insert(recipeTags)
        .values(toRetag.map((recipeId) => ({ recipeId, tagId: targetId })))
        .run();
    }

    touchRecipes(tx, affected);
    tx.update(tags).set({ updatedAt: new Date() }).where(eq(tags.id, targetId)).run();
    tx.delete(tags).where(eq(tags.id, sourceId)).run(); // cascades the source's recipe_tags
    recordTombstone(tx, "tag", source.publicId);
    return affected.length;
  });
}

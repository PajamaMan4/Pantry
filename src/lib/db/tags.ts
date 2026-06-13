import { asc, sql } from "drizzle-orm";
import { db } from "./client";
import { tags, type Tag } from "./schema";

export function listTags(): Tag[] {
  return db.select().from(tags).orderBy(asc(tags.name)).all();
}

/** Get an existing tag by case-insensitive name, or create it. */
export function getOrCreateTag(name: string): Tag {
  const n = name.trim();
  const existing = db
    .select()
    .from(tags)
    .where(sql`lower(${tags.name}) = lower(${n})`)
    .get();
  if (existing) return existing;
  return db.insert(tags).values({ name: n }).returning().get();
}

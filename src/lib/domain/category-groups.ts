// Buckets a flat list into sections by ingredient category (§ shopping/menu/
// inventory "group by category" — the category-based sibling of
// location-groups.ts, used when storage locations are hidden). Pure + tested.
export const UNCATEGORIZED_LABEL = "Uncategorized";

export type CategoryGroup<T> = { name: string; items: T[] };

/** "grains" -> "Grains", "grains & pasta" -> "Grains & Pasta". */
function titleCase(s: string): string {
  return s.replace(/\S+/g, (word) => word[0].toUpperCase() + word.slice(1));
}

/**
 * Bucket items by their ingredient category, case-insensitively (stored
 * values are free text and never normalized, so "Dairy" and "dairy" must
 * merge). Items with no category (null, or blank after trimming) land in an
 * "Uncategorized" bucket sorted last. Groups are otherwise ordered
 * alphabetically by their Title Case display name; item order within a group
 * is preserved. Stored category strings are never rewritten — only the
 * rendered group name is Title Cased.
 */
export function groupByCategory<T>(
  items: T[],
  categoryOf: (item: T) => string | null,
): CategoryGroup<T>[] {
  const groups = new Map<string, CategoryGroup<T>>();
  for (const item of items) {
    const raw = categoryOf(item)?.trim();
    const key = raw ? raw.toLowerCase() : "";
    const name = key ? titleCase(key) : UNCATEGORIZED_LABEL;
    const g = groups.get(key) ?? { name, items: [] };
    g.items.push(item);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.name === UNCATEGORIZED_LABEL) return 1;
    if (b.name === UNCATEGORIZED_LABEL) return -1;
    return a.name.localeCompare(b.name);
  });
}

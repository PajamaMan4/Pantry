// Buckets a flat list into sections by storage location (§ shopping/menu
// "group by location"). Pure + tested; mirrors the grouping the /ingredients
// LocationView has done inline, so both list pages and that view can share it.
export type LocationRef = { name: string; sortOrder: number } | null;

export const UNSORTED_LABEL = "Unsorted";

export type LocationGroup<T> = { name: string; sortOrder: number; items: T[] };

/**
 * Bucket items by their location name. Items with no location (null) land in
 * an "Unsorted" bucket sorted last. Groups are otherwise ordered by
 * sortOrder, then name; item order within a group is preserved.
 */
export function groupByLocation<T>(items: T[], locationOf: (item: T) => LocationRef): LocationGroup<T>[] {
  const groups = new Map<string, LocationGroup<T>>();
  for (const item of items) {
    const loc = locationOf(item);
    const name = loc?.name ?? UNSORTED_LABEL;
    const sortOrder = loc?.sortOrder ?? 9999;
    const g = groups.get(name) ?? { name, sortOrder, items: [] };
    g.items.push(item);
    groups.set(name, g);
  }
  return [...groups.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

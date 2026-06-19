// Variant grouping for the recipe list (§ variants). Pure + tested.
//
// Recipes that share a group are "variants" of one another. On the list/search
// page we collapse them: when 2+ recipes of the same group survive the active
// search + filters, they are folded into a single group row. A group with only
// one matching member shows as a normal single row — the group never stands in
// for members that didn't match the search.

export type GroupRef = { id: number; name: string };

export type CollapsedRow<T> =
  | { kind: "single"; item: T }
  | { kind: "group"; group: GroupRef; members: T[] };

/**
 * Fold an already-filtered, already-ordered list of items into rows. Items
 * sharing a group with 2+ members present become one group row, placed at the
 * position of that group's best-ranked (first-seen) member; everything else
 * stays a single row. Order is otherwise preserved.
 */
export function collapseIntoGroups<T>(
  items: T[],
  getGroup: (item: T) => GroupRef | null,
): CollapsedRow<T>[] {
  // Count how many matching items each group has, so a lone member renders plain.
  const counts = new Map<number, number>();
  for (const item of items) {
    const group = getGroup(item);
    if (group) counts.set(group.id, (counts.get(group.id) ?? 0) + 1);
  }

  const rows: CollapsedRow<T>[] = [];
  const groupRowIndex = new Map<number, number>();
  for (const item of items) {
    const group = getGroup(item);
    if (!group || (counts.get(group.id) ?? 0) < 2) {
      rows.push({ kind: "single", item });
      continue;
    }
    const existing = groupRowIndex.get(group.id);
    if (existing == null) {
      groupRowIndex.set(group.id, rows.length);
      rows.push({ kind: "group", group, members: [item] });
    } else {
      (rows[existing] as Extract<CollapsedRow<T>, { kind: "group" }>).members.push(item);
    }
  }
  return rows;
}

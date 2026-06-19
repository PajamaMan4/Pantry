// Ingredient sections (§2.4) — pure, framework-agnostic helpers for the two
// shapes a recipe's ingredient list can take:
//
//   Flat:       T[]                                  (a simple single-part recipe)
//   Sectioned:  { title: string; ingredients: T[] }  (multi-part: "For the crust", ...)
//
// The shape is generic in the ingredient object `T` so the same helpers serve the
// import/export JSON (file ingredients) and any other in-memory ingredient model.
import { z } from "zod";

export interface IngredientSection<T> {
  title: string;
  ingredients: T[];
}

/** A recipe's ingredient list: either flat, or grouped into labeled sections. */
export type IngredientGroups<T> = T[] | IngredientSection<T>[];

/** A section after normalization; `title === null` means the flat/unlabeled list. */
export interface NormalizedSection<T> {
  title: string | null;
  ingredients: T[];
}

function looksLikeSection(value: unknown): value is IngredientSection<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    "title" in value &&
    "ingredients" in value &&
    Array.isArray((value as { ingredients: unknown }).ingredients)
  );
}

/**
 * Runtime type guard distinguishing the two shapes. An empty list is treated as
 * flat (there are no sections to render). A non-empty list is sectioned iff its
 * first element has the `{ title, ingredients }` shape.
 */
export function isSectioned<T>(groups: IngredientGroups<T>): groups is IngredientSection<T>[] {
  return groups.length > 0 && looksLikeSection(groups[0]);
}

/** Flatten either shape to a single ordered ingredient list. */
export function flattenGroups<T>(groups: IngredientGroups<T>): T[] {
  return isSectioned(groups) ? groups.flatMap((s) => s.ingredients) : groups;
}

/**
 * Normalize either shape to an array of sections for rendering. A flat list
 * becomes a single section with `title: null` (rendered as an unlabeled list).
 */
export function toSections<T>(groups: IngredientGroups<T>): NormalizedSection<T>[] {
  if (isSectioned(groups)) return groups.map((s) => ({ title: s.title, ingredients: s.ingredients }));
  return [{ title: null, ingredients: groups }];
}

/**
 * Group an already-flat array of ingredient rows (each carrying an optional
 * `section_title`) into contiguous sections for rendering, while preserving each
 * row's original index — callers rely on the index to line items up with a
 * parallel array (e.g. inventory-match statuses).
 *
 * If every row's title is null the result is a single `title: null` section,
 * matching how a flat list renders.
 */
export function groupRowsBySection<T>(
  rows: T[],
  titleOf: (row: T) => string | null,
): { title: string | null; items: { row: T; index: number }[] }[] {
  const out: { title: string | null; items: { row: T; index: number }[] }[] = [];
  rows.forEach((row, index) => {
    const title = titleOf(row) ?? null;
    const last = out[out.length - 1];
    if (last && last.title === title) last.items.push({ row, index });
    else out.push({ title, items: [{ row, index }] });
  });
  return out;
}

/**
 * Build a Zod schema for a recipe ingredient list that accepts either shape,
 * given the schema for a single ingredient object. Used by the .pantry import
 * format; malformed input fails this schema with a clear error.
 */
export function ingredientGroupsSchema<T extends z.ZodTypeAny>(item: T) {
  const section = z.object({ title: z.string().min(1), ingredients: z.array(item) });
  return z.union([z.array(item), z.array(section)]);
}

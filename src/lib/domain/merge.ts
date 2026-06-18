// Pure helpers for the ingredient merge/dedupe tool (§8). Kept here, free of I/O,
// so the fiddly "repoint references inside recipe-step JSON" logic is unit-tested
// independently of the database layer.

import type { Step } from "@/lib/db/schema";

/**
 * Repoint every step-quantity reference from `fromId` to `toId` within one
 * recipe's steps. Returns the (possibly new) steps array and whether anything
 * changed, so callers can skip writing untouched recipes. Never mutates input.
 */
export function repointStepIngredient(
  steps: Step[],
  fromId: number,
  toId: number,
): { steps: Step[]; changed: boolean } {
  let changed = false;

  const next = steps.map((step) => {
    if (!step.quantities) return step;

    let stepChanged = false;
    const quantities: NonNullable<Step["quantities"]> = {};
    for (const [key, q] of Object.entries(step.quantities)) {
      if (q.ingredientId === fromId) {
        quantities[key] = { ...q, ingredientId: toId };
        stepChanged = true;
      } else {
        quantities[key] = q;
      }
    }

    if (!stepChanged) return step;
    changed = true;
    return { ...step, quantities };
  });

  return changed ? { steps: next, changed } : { steps, changed: false };
}

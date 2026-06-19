// "I made this" deduction planning (§3.6). Pure + heavily tested — this decides
// exactly what to deduct from which inventory rows, with full unit reconciliation
// and all the edge cases. The DB service just applies the plan in a transaction.
import { convert } from "./units";

export interface CookIngredientInput {
  ingredientId: number;
  name: string;
  amount: number | null; // recipe amount at base servings (null => non-numeric)
  unit: string | null;
  optional: boolean;
  isStaple: boolean;
  density: number | null;
}

export interface CookStockRow {
  inventoryItemId: number;
  quantity: number;
  unit: string;
  expiryMs: number | null; // for FIFO-by-expiry ordering
}

export interface CookDeduction {
  inventoryItemId: number;
  ingredientId: number;
  amount: number; // in the inventory row's unit
  unit: string;
}

export type CookLineStatus =
  | "ok" // fully deducted
  | "partial" // ran low — deducted what was available
  | "missing" // required, but not in inventory
  | "unconvertible" // can't reconcile recipe unit with stocked units
  | "skipped"; // staple/optional not in stock, or non-numeric — nothing to do

export interface CookLine {
  ingredientId: number;
  name: string;
  requiredAmount: number | null; // scaled, in recipe unit
  requiredUnit: string | null;
  deductions: CookDeduction[];
  status: CookLineStatus;
  note?: string; // human-readable flag (only for surfaced issues)
}

export interface CookPlan {
  lines: CookLine[];
  deductions: CookDeduction[]; // flattened, ready to apply
  warnings: string[];
}

const EPS = 1e-9;

function planOne(ing: CookIngredientInput, rows: CookStockRow[], factor: number): CookLine {
  const base = {
    ingredientId: ing.ingredientId,
    name: ing.name,
    requiredUnit: ing.unit,
    deductions: [] as CookDeduction[],
  };

  // Non-numeric ("to taste") or unit-less amounts can't be deducted.
  if (ing.amount == null || ing.unit == null) {
    return { ...base, requiredAmount: null, status: "skipped" };
  }

  const required = ing.amount * factor;

  if (rows.length === 0) {
    // Staples and optionals are assumed available / may be skipped — no warning.
    if (ing.isStaple || ing.optional) return { ...base, requiredAmount: required, status: "skipped" };
    return { ...base, requiredAmount: required, status: "missing", note: `${ing.name}: not in inventory — not deducted` };
  }

  // Soonest-expiry first (FIFO-by-expiry); undated rows last.
  const ordered = [...rows].sort((a, b) => (a.expiryMs ?? Infinity) - (b.expiryMs ?? Infinity));

  let remaining = required; // tracked in the recipe's unit
  let anyConvertible = false;
  const deductions: CookDeduction[] = [];

  for (const row of ordered) {
    if (remaining <= EPS) break;
    let neededInRowUnit: number;
    try {
      neededInRowUnit = convert(remaining, ing.unit, row.unit, ing.density ?? undefined);
    } catch {
      continue; // this row's unit can't be reconciled with the recipe unit
    }
    anyConvertible = true;
    const deduct = Math.min(row.quantity, neededInRowUnit);
    if (deduct <= EPS) continue;
    deductions.push({ inventoryItemId: row.inventoryItemId, ingredientId: ing.ingredientId, amount: deduct, unit: row.unit });
    remaining -= convert(deduct, row.unit, ing.unit, ing.density ?? undefined);
  }

  if (!anyConvertible) {
    return {
      ...base,
      requiredAmount: required,
      deductions: [],
      status: "unconvertible",
      note: `${ing.name}: can't convert ${ing.unit} to the stocked unit — not deducted`,
    };
  }

  if (remaining > EPS) {
    const note = ing.isStaple || ing.optional ? undefined : `${ing.name}: ran low — deducted what was in stock`;
    return { ...base, requiredAmount: required, deductions, status: "partial", note };
  }

  return { ...base, requiredAmount: required, deductions, status: "ok" };
}

/**
 * Combine every occurrence of one ingredient (e.g. butter appearing in both
 * "For the crust" and "For the filling") into a single requirement, summing the
 * numeric amounts after reconciling units. Non-numeric occurrences ("to taste")
 * contribute nothing to the total. The summed requirement is what we compare to
 * stock, so availability reflects the *combined* need, not any one line (§3.3).
 */
function combineOccurrences(members: CookIngredientInput[]): CookIngredientInput {
  const first = members[0];
  const numeric = members.filter((m) => m.amount != null && m.unit != null);
  if (numeric.length === 0) return { ...first, amount: null, unit: null };

  const repUnit = numeric[0].unit!;
  let total = 0;
  for (const m of numeric) {
    try {
      total += convert(m.amount!, m.unit!, repUnit, first.density ?? undefined);
    } catch {
      // Same ingredient stocked in an unreconcilable unit — best-effort raw add.
      total += m.amount!;
    }
  }
  // Optional only if *every* occurrence is optional; staple is ingredient-level.
  return { ...first, amount: total, unit: repUnit, optional: members.every((m) => m.optional) };
}

export function planCook(
  ingredients: CookIngredientInput[],
  stockByIngredient: Map<number, CookStockRow[]>,
  factor: number,
): CookPlan {
  // Group line positions by ingredient so duplicates across sections are summed
  // and checked against stock once (and deducted once — never double-counted).
  const groups = new Map<number, number[]>();
  for (let i = 0; i < ingredients.length; i++) {
    const id = ingredients[i].ingredientId;
    const idxs = groups.get(id);
    if (idxs) idxs.push(i);
    else groups.set(id, [i]);
  }

  const lines: CookLine[] = new Array(ingredients.length);
  const deductions: CookDeduction[] = [];
  const warnings: string[] = [];

  for (const [ingredientId, idxs] of groups) {
    const members = idxs.map((i) => ingredients[i]);
    const combined = combineOccurrences(members);
    const group = planOne(combined, stockByIngredient.get(ingredientId) ?? [], factor);

    idxs.forEach((lineIndex, k) => {
      const member = ingredients[lineIndex];
      // A non-numeric occurrence is nothing to check on its own line; every other
      // occurrence reflects the combined availability status.
      const nonNumeric = member.amount == null || member.unit == null;
      lines[lineIndex] = {
        ingredientId,
        name: member.name,
        requiredUnit: member.unit,
        requiredAmount: member.amount == null ? null : member.amount * factor,
        // Emit the group's deductions/warning once, on its first occurrence.
        deductions: k === 0 ? group.deductions : [],
        status: nonNumeric ? "skipped" : group.status,
        note: k === 0 ? group.note : undefined,
      };
    });

    deductions.push(...group.deductions);
    if (group.note != null) warnings.push(group.note);
  }

  return { lines, deductions, warnings };
}

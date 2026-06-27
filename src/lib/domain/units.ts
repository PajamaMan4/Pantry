// Domain value objects + the canonical unit table (§2.2, Appendix A).
//
// Units are domain constants, NOT a DB table: recipes/inventory/prices store a
// unit *id* (e.g. "tbsp", "g") as text and resolve it here. Conversion and
// formatting logic (`convert()`, `formatQuantity()`) land in Phase 2; this file
// is intentionally just the data + types the data layer and seed depend on.

export type UnitCategory = "volume" | "mass" | "count";
export type UnitSystem = "metric" | "imperial";

export interface UnitDef {
  id: string; // "tbsp", "g", "cup", "each"...
  label: string; // display label
  category: UnitCategory;
  system: UnitSystem | "either";
  toBase: number; // multiply to convert to the category base (ml volume, g mass, 1 count)
  approximate?: boolean; // true for "pinch" etc. -> never scaled
}

// A quantity is amount + unit, with support for ranges and non-numeric descriptors.
export interface Quantity {
  amount: number | null; // null => non-numeric (e.g. "to taste")
  amountMax?: number | null; // for ranges, e.g. 2-3 tbsp
  unit: string | null; // UnitDef.id, or null for counts / non-numeric
  raw?: string | null; // original descriptor when non-numeric ("a pinch", "to taste")
  approximate?: boolean; // true for "pinch", "to taste", etc. -> never scaled
}

// Base units: ml (volume), g (mass), 1 (count). Factors are exact (Appendix A);
// the "cooking" rounding mode produces friendlier display values at format time.
export const UNITS: Record<string, UnitDef> = {
  tsp: { id: "tsp", label: "tsp", category: "volume", system: "imperial", toBase: 4.92892 },
  tbsp: { id: "tbsp", label: "tbsp", category: "volume", system: "imperial", toBase: 14.78676 },
  fl_oz: { id: "fl_oz", label: "fl oz", category: "volume", system: "imperial", toBase: 29.57353 },
  cup: { id: "cup", label: "cup", category: "volume", system: "imperial", toBase: 236.5882 },
  qt: { id: "qt", label: "qt", category: "volume", system: "imperial", toBase: 946.353 },
  gal: { id: "gal", label: "gal", category: "volume", system: "imperial", toBase: 3785.41 },
  ml: { id: "ml", label: "ml", category: "volume", system: "metric", toBase: 1 },
  l: { id: "l", label: "L", category: "volume", system: "metric", toBase: 1000 },
  oz: { id: "oz", label: "oz", category: "mass", system: "imperial", toBase: 28.34952 },
  lb: { id: "lb", label: "lb", category: "mass", system: "imperial", toBase: 453.59237 },
  g: { id: "g", label: "g", category: "mass", system: "metric", toBase: 1 },
  kg: { id: "kg", label: "kg", category: "mass", system: "metric", toBase: 1000 },
  each: { id: "each", label: "", category: "count", system: "either", toBase: 1 },
  pinch: {
    id: "pinch",
    label: "pinch",
    category: "volume",
    system: "either",
    toBase: 0.31,
    approximate: true,
  },
};

// Default densities (g/ml) for volume<->weight bridging (Appendix B). Keyed by
// canonical ingredient name; seeded onto ingredients so "1 cup flour -> grams"
// works. Ingredients without a density stay within their measurement category.
export const DEFAULT_DENSITIES: Record<string, number> = {
  Water: 1.0,
  Milk: 1.03,
  "All-purpose flour": 0.53,
  "Granulated sugar": 0.85,
  Butter: 0.96,
  Honey: 1.42,
  "Vegetable oil": 0.92,
};

export function getUnit(id: string | null | undefined): UnitDef | undefined {
  return id ? UNITS[id] : undefined;
}

export function categoryOf(unit: string | null | undefined): UnitCategory | undefined {
  return unit ? UNITS[unit]?.category : undefined;
}

export const UNIT_IDS = Object.keys(UNITS);

// ---- Conversion (§5.2) ------------------------------------------------------
export class UnconvertibleError extends Error {
  constructor(
    public from: string | null,
    public to: string | null,
  ) {
    super(`Cannot convert ${from} → ${to} (missing conversion factor).`);
    this.name = "UnconvertibleError";
  }
}

/**
 * Convert `value` from one unit to another. Same-category conversions are exact
 * (cup↔ml, oz↔g). Cross-category conversions pivot through grams:
 *   volume↔mass requires densityGperMl; count↔mass requires gramsPerEach;
 *   count↔volume requires both. Missing factors throw UnconvertibleError.
 * NOTE: mass `oz` and volume `fl_oz` are distinct units and never conflated.
 */
export function convert(
  value: number,
  from: string,
  to: string,
  densityGperMl?: number,
  gramsPerEach?: number,
): number {
  const f = UNITS[from];
  const t = UNITS[to];
  if (!f || !t) throw new UnconvertibleError(from, to);
  if (f.category === t.category) return (value * f.toBase) / t.toBase;

  // Pivot through grams: fromBase → g → toBase
  const baseAmount = value * f.toBase;
  let grams: number;
  if (f.category === "mass") {
    grams = baseAmount;
  } else if (f.category === "volume") {
    if (!densityGperMl) throw new UnconvertibleError(from, to);
    grams = baseAmount * densityGperMl;
  } else {
    if (!gramsPerEach) throw new UnconvertibleError(from, to);
    grams = baseAmount * gramsPerEach;
  }

  let targetBase: number;
  if (t.category === "mass") {
    targetBase = grams;
  } else if (t.category === "volume") {
    if (!densityGperMl) throw new UnconvertibleError(from, to);
    targetBase = grams / densityGperMl;
  } else {
    if (!gramsPerEach) throw new UnconvertibleError(from, to);
    targetBase = grams / gramsPerEach;
  }

  return targetBase / t.toBase;
}

/**
 * Sum multiple occurrences of the same ingredient into one {amount, unit}.
 * Uses the first numeric occurrence's unit as the representative; converts
 * others via convert(), raw-adding when unconvertible (same ingredient in an
 * irreconcilable unit). Non-numeric occurrences contribute nothing.
 * Returns {amount: null, unit: null} when no numeric occurrence exists.
 */
export function combineAmounts(
  occ: { amount: number | null; unit: string | null }[],
  density?: number | null,
  gramsPerEach?: number | null,
): { amount: number | null; unit: string | null } {
  const numeric = occ.filter((o) => o.amount != null && o.unit != null);
  if (numeric.length === 0) return { amount: null, unit: null };
  const repUnit = numeric[0].unit!;
  let total = 0;
  for (const o of numeric) {
    try {
      total += convert(o.amount!, o.unit!, repUnit, density ?? undefined, gramsPerEach ?? undefined);
    } catch {
      total += o.amount!;
    }
  }
  return { amount: total, unit: repUnit };
}

export interface ConvertedQuantity {
  amount: number;
  amountMax: number | null;
  unit: string | null;
}

/**
 * Pick a sensible unit in `system` for an amount expressed in base units
 * (ml for volume, g for mass): metric splits at 1000 (ml/L, g/kg); imperial
 * volume picks tsp/tbsp/cup and imperial mass picks oz/lb by magnitude.
 */
function pickTargetUnit(category: UnitCategory, system: UnitSystem, baseAmount: number): string {
  const a = Math.abs(baseAmount);
  if (category === "volume") {
    if (system === "metric") return a >= 1000 ? "l" : "ml";
    if (a < UNITS.tbsp.toBase) return "tsp"; // < ~14.8 ml
    if (a < UNITS.cup.toBase / 4) return "tbsp"; // < ~59 ml (quarter cup)
    if (a < UNITS.qt.toBase) return "cup"; // < ~946 ml
    if (a < UNITS.gal.toBase) return "qt"; // < ~3785 ml
    return "gal";
  }
  if (category === "mass") {
    if (system === "metric") return a >= 1000 ? "kg" : "g";
    return a < UNITS.lb.toBase ? "oz" : "lb"; // < ~454 g
  }
  return "each";
}

/**
 * Convert a quantity into the requested unit system, choosing a sensible target
 * unit. Counts, approximate units (pinch), unit-less amounts, and amounts that
 * are already in the target system are returned unchanged. Conversions here stay
 * within a category (volume→volume, mass→mass), so no density is needed.
 */
export function toSystem(
  q: { amount: number; amountMax?: number | null; unit: string | null },
  system: UnitSystem,
  density?: number,
  gramsPerEach?: number,
): ConvertedQuantity {
  const def = q.unit ? UNITS[q.unit] : undefined;
  if (!def || def.category === "count" || def.approximate || def.system === system) {
    return { amount: q.amount, amountMax: q.amountMax ?? null, unit: q.unit };
  }
  const target = pickTargetUnit(def.category, system, q.amount * def.toBase);
  return {
    amount: convert(q.amount, q.unit!, target, density, gramsPerEach),
    amountMax: q.amountMax != null ? convert(q.amountMax, q.unit!, target, density, gramsPerEach) : null,
    unit: target,
  };
}

// Ordered options for unit <select> dropdowns in the recipe editor.
export const UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: "each", label: "each / count" },
  { value: "tsp", label: "tsp" },
  { value: "tbsp", label: "tbsp" },
  { value: "fl_oz", label: "fl oz" },
  { value: "cup", label: "cup" },
  { value: "qt", label: "qt" },
  { value: "gal", label: "gal" },
  { value: "ml", label: "ml" },
  { value: "l", label: "L" },
  { value: "oz", label: "oz" },
  { value: "lb", label: "lb" },
  { value: "g", label: "g" },
  { value: "kg", label: "kg" },
  { value: "pinch", label: "pinch" },
];

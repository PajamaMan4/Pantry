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

export const UNIT_IDS = Object.keys(UNITS);

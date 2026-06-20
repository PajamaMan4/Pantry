// Maps common unit words onto canonical unit ids (matching UNITS in domain/units.ts).
// Used by recipe import and inventory import to normalize user-supplied unit strings.
const UNIT_ALIASES: Record<string, string> = {
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  tbsp: "tbsp", tbs: "tbsp", tbl: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
  "fl oz": "fl_oz", floz: "fl_oz", fl_oz: "fl_oz", "fluid ounce": "fl_oz", "fluid ounces": "fl_oz",
  cup: "cup", cups: "cup", c: "cup",
  qt: "qt", quart: "qt", quarts: "qt",
  gal: "gal", gallon: "gal", gallons: "gal",
  ml: "ml", milliliter: "ml", millilitre: "ml", milliliters: "ml", millilitres: "ml",
  l: "l", liter: "l", litre: "l", liters: "l", litres: "l",
  oz: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  g: "g", gram: "g", grams: "g", gramme: "g", grammes: "g",
  kg: "kg", kilogram: "kg", kilograms: "kg", kilo: "kg", kilos: "kg",
  each: "each", whole: "each",
  pinch: "pinch", pinches: "pinch",
};

export function normalizeUnit(unit: string | null | undefined): string | null {
  if (!unit) return null;
  return UNIT_ALIASES[unit.trim().toLowerCase()] ?? null;
}

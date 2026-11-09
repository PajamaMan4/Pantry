// Combined on-hand total for one ingredient across its inventory items. Pure + tested.
import { UNITS, type UnitDef } from "./units";
import { displayQuantity, type DisplaySystem } from "./scaling";
import type { RoundingMode } from "./quantity";

const BASE_UNIT: Record<UnitDef["category"], string> = { volume: "ml", mass: "g", count: "each" };

/**
 * Sum convertible units per category so 1 lb + 16 oz reads as one "2 lb" rather
 * than two entries. "As written" has no target system to convert to, so the
 * total uses the largest unit actually entered. Approximate units (pinch, etc.)
 * and unitless amounts aren't convertible and stay in their own per-unit groups.
 */
export function aggregateStock(
  items: { quantity: number; unit: string | null }[],
  system: DisplaySystem,
  rounding: RoundingMode,
  density?: number | null,
): string | null {
  if (items.length === 0) return null;

  const byCategory = new Map<UnitDef["category"], { base: number; largest: UnitDef }>();
  const byUnit = new Map<string, number>();
  for (const item of items) {
    const def = item.unit ? UNITS[item.unit] : undefined;
    if (!def || def.approximate) {
      const key = item.unit ?? "";
      byUnit.set(key, (byUnit.get(key) ?? 0) + item.quantity);
      continue;
    }
    const total = byCategory.get(def.category);
    byCategory.set(def.category, {
      base: (total?.base ?? 0) + item.quantity * def.toBase,
      largest: total && total.largest.toBase >= def.toBase ? total.largest : def,
    });
  }

  const parts: string[] = [...byCategory.entries()].map(([category, { base, largest }]) => {
    const asWritten = system === "original";
    return displayQuantity(
      {
        amount: asWritten ? base / largest.toBase : base,
        amountMax: null,
        unit: asWritten ? largest.id : BASE_UNIT[category],
        raw: null,
      },
      { factor: 1, system, rounding, density: density ?? undefined },
    );
  });
  for (const [unit, qty] of byUnit) {
    parts.push(
      displayQuantity({ amount: qty, amountMax: null, unit: unit || null, raw: null }, { factor: 1, system, rounding }),
    );
  }

  return parts.join(" + ");
}

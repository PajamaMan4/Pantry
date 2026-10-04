// Turns Open Food Facts' quantity fields into a canonical Pantry {amount, unit}.
// Pure, no I/O — see src/lib/barcode/lookup-product.ts for the fetch that feeds it.

import { normalizeUnit } from "@/lib/import/normalize-unit";

export interface ProductQuantity {
  amount: number;
  unit: string;
}

// Scale-factor units Open Food Facts uses constantly that normalizeUnit doesn't
// know (it maps words onto Pantry's canonical UNIT_IDS 1:1). Each entry gives a
// canonical unit id plus the multiplier to reach it.
const SCALED_UNITS: Record<string, { unit: string; factor: number }> = {
  cl: { unit: "ml", factor: 10 },
  centiliter: { unit: "ml", factor: 10 },
  centiliters: { unit: "ml", factor: 10 },
  centilitre: { unit: "ml", factor: 10 },
  centilitres: { unit: "ml", factor: 10 },
  dl: { unit: "ml", factor: 100 },
  deciliter: { unit: "ml", factor: 100 },
  deciliters: { unit: "ml", factor: 100 },
  decilitre: { unit: "ml", factor: 100 },
  decilitres: { unit: "ml", factor: 100 },
  mg: { unit: "g", factor: 0.001 },
  milligram: { unit: "g", factor: 0.001 },
  milligrams: { unit: "g", factor: 0.001 },
};

/** Resolve a raw unit word to a canonical {unit, factor}, or null if unrecognized. */
function resolveUnit(raw: string): { unit: string; factor: number } | null {
  const cleaned = raw.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
  const scaled = SCALED_UNITS[cleaned];
  if (scaled) return scaled;
  const normalized = normalizeUnit(cleaned);
  return normalized ? { unit: normalized, factor: 1 } : null;
}

// "500 g", "355g" (no space), "1,5 L" (European decimal comma), "16.9 fl oz".
const QUANTITY_RE = /^([\d.,]+)\s*([a-zA-Z ]+)$/;
// "12 x 330 ml" / "12x330ml" multipacks.
const MULTIPACK_RE = /^(\d+)\s*x\s*([\d.,]+)\s*([a-zA-Z ]+)$/i;

function parseNumber(raw: string): number | null {
  // A comma is a decimal separator here (not a thousands separator) — OFF's
  // quantity strings are short single amounts, e.g. "1,5 L".
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Parse a free-text OFF `quantity` string like "500 g" or "12 x 330 ml". */
function parseQuantityString(text: string): ProductQuantity | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const multipack = MULTIPACK_RE.exec(trimmed);
  if (multipack) {
    const count = Number(multipack[1]);
    const amount = parseNumber(multipack[2]);
    const resolved = resolveUnit(multipack[3]);
    if (count > 0 && amount != null && amount > 0 && resolved) {
      return { amount: count * amount * resolved.factor, unit: resolved.unit };
    }
  }

  const match = QUANTITY_RE.exec(trimmed);
  if (!match) return null;
  const amount = parseNumber(match[1]);
  const resolved = resolveUnit(match[2]);
  if (amount == null || amount <= 0 || !resolved) return null;
  return { amount: amount * resolved.factor, unit: resolved.unit };
}

/** Turn Open Food Facts' quantity fields into a canonical {amount, unit}, or null. */
export function parseProductQuantity(input: {
  productQuantity?: number | string | null;
  productQuantityUnit?: string | null;
  quantity?: string | null;
}): ProductQuantity | null {
  if (input.productQuantity != null && input.productQuantityUnit) {
    const amount = typeof input.productQuantity === "number" ? input.productQuantity : Number(input.productQuantity);
    const resolved = resolveUnit(input.productQuantityUnit);
    if (Number.isFinite(amount) && amount > 0 && resolved) {
      return { amount: amount * resolved.factor, unit: resolved.unit };
    }
  }
  if (input.quantity) return parseQuantityString(input.quantity);
  return null;
}

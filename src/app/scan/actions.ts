"use server";

import { lookupBarcode, type BarcodeLookup } from "@/lib/import/open-food-facts";

/** Look up a scanned/typed barcode. Validates shape before hitting the network. */
export async function lookupBarcodeAction(code: string): Promise<BarcodeLookup> {
  const digits = code.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 14) {
    return { ok: false, error: "That doesn't look like a barcode (expected 8–14 digits)." };
  }
  return lookupBarcode(digits);
}

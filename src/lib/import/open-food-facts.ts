import "server-only";

import { z } from "zod";
import { parseProductQuantity } from "@/lib/domain/product-quantity";

// Looks up a scanned barcode against Open Food Facts (https://openfoodfacts.org),
// a free, no-API-key product database. This is the one external call in the
// barcode-scan spike (see src/app/scan/) — a deliberate exception to the app's
// local-first posture, made only to test whether in-browser scanning + product
// lookup is worth building on.

const ENDPOINT = "https://world.openfoodfacts.org/api/v2/product";
const FIELDS =
  "code,product_name,product_name_en,generic_name,brands,quantity,product_quantity,product_quantity_unit,image_front_small_url";
// OFF asks integrators to identify themselves (AppName/Version (contact)) rather
// than send a default HTTP client UA. Left generic on purpose: no user contact
// info goes to a third-party service.
const USER_AGENT = "Pantry/0.1 (local-first pantry app; testing)";

const responseSchema = z.object({
  status: z.number().optional(),
  status_verbose: z.string().optional(),
  product: z
    .object({
      code: z.string().optional(),
      product_name: z.string().optional(),
      product_name_en: z.string().optional(),
      generic_name: z.string().optional(),
      brands: z.string().optional(),
      quantity: z.string().optional(),
      product_quantity: z.union([z.number(), z.string()]).optional(),
      product_quantity_unit: z.string().optional(),
      image_front_small_url: z.string().optional(),
    })
    .optional(),
});

export type BarcodeProduct = {
  code: string;
  name: string;
  brand: string | null;
  amount: number | null;
  unit: string | null;
  imageUrl: string | null;
};

export type BarcodeLookup =
  | { ok: true; product: BarcodeProduct }
  | { ok: false; error: string; notFound?: boolean };

/** Look up a barcode's name and amount against Open Food Facts. */
export async function lookupBarcode(code: string): Promise<BarcodeLookup> {
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}/${encodeURIComponent(code)}.json?fields=${FIELDS}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }

  // Well-formed-but-unknown codes come back as a plain 404.
  if (res.status === 404) {
    return { ok: false, error: "That barcode isn't in Open Food Facts.", notFound: true };
  }
  if (!res.ok) {
    return { ok: false, error: `Open Food Facts request failed (${res.status}). Try again.` };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: "Couldn't read the response from Open Food Facts." };
  }

  const parsed = responseSchema.safeParse(json);
  // Malformed codes come back as HTTP 200 with status: 0 — the other "not found".
  if (!parsed.success || parsed.data.status !== 1 || !parsed.data.product) {
    return { ok: false, error: "That barcode isn't in Open Food Facts.", notFound: true };
  }

  const p = parsed.data.product;
  const name = p.product_name_en?.trim() || p.product_name?.trim() || p.generic_name?.trim() || "";
  const parsedQuantity = parseProductQuantity({
    productQuantity: p.product_quantity ?? null,
    productQuantityUnit: p.product_quantity_unit ?? null,
    quantity: p.quantity ?? null,
  });

  return {
    ok: true,
    product: {
      code: p.code ?? code,
      name,
      brand: p.brands?.trim() || null,
      amount: parsedQuantity?.amount ?? null,
      unit: parsedQuantity?.unit ?? null,
      imageUrl: p.image_front_small_url ?? null,
    },
  };
}

function describeError(err: unknown): string {
  if (err instanceof DOMException && err.name === "TimeoutError") {
    return "The lookup timed out. Try again.";
  }
  if (err instanceof Error && err.name === "AbortError") {
    return "The lookup timed out. Try again.";
  }
  return "Couldn't reach Open Food Facts. Check your connection and try again.";
}

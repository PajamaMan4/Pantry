import { z } from "zod";
import { idOrNull, unitRequired, nullableDate, nullableText } from "./common";

const ingredientRef = {
  ingredientId: idOrNull,
  name: nullableText,
};
const locationRef = {
  locationId: idOrNull,
  locationName: nullableText,
};
const hasIngredient = (r: { ingredientId: number | null; name: string | null }) =>
  r.ingredientId != null || (r.name != null && r.name.length > 0);

export const inventoryItemSchema = z
  .object({
    ...ingredientRef,
    ...locationRef,
    quantity: z.coerce.number().finite().nonnegative(),
    unit: unitRequired,
    expiryDate: nullableDate,
    openedDate: nullableDate,
    notes: nullableText,
  })
  .refine(hasIngredient, { message: "Pick an ingredient or type a name.", path: ["name"] });

export type InventoryItemValues = z.infer<typeof inventoryItemSchema>;

export const logPurchaseSchema = z
  .object({
    ...ingredientRef,
    ...locationRef,
    quantity: z.coerce.number().positive("Quantity must be greater than 0"),
    unit: unitRequired,
    price: z.coerce.number().nonnegative("Price can't be negative"),
    store: nullableText,
    purchasedAt: z.preprocess(
      (v) => (v === "" || v == null ? new Date() : v),
      z.coerce.date(),
    ),
    expiryDate: nullableDate,
  })
  .refine(hasIngredient, { message: "Pick an ingredient or type a name.", path: ["name"] });

export type LogPurchaseValues = z.infer<typeof logPurchaseSchema>;

// Adding a price directly on the ingredient detail page (ingredientId comes from the route).
export const priceEntrySchema = z.object({
  price: z.coerce.number().nonnegative("Price can't be negative"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  unit: unitRequired,
  store: nullableText,
  purchasedAt: z.preprocess((v) => (v === "" || v == null ? new Date() : v), z.coerce.date()),
});

export type PriceEntryValues = z.infer<typeof priceEntrySchema>;

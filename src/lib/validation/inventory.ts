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

// Bulk draw-down from the Remove Inventory page: each line targets an exact
// inventory row and removes an amount in that row's own unit.
export const inventoryRemoveSchema = z
  .array(
    z.object({
      inventoryItemId: z.coerce.number().int().positive(),
      amount: z.coerce.number().positive("Amount must be greater than 0"),
    }),
  )
  .min(1, "Add at least one item to remove.");

export type InventoryRemoveValues = z.infer<typeof inventoryRemoveSchema>;

// Commit payload from the bulk Inventory Edit page: a diff computed client-side
// (see src/lib/domain/inventory-edit.ts) that's applied in one transaction.
// `updates.quantity` is nonnegative (0 is allowed — it zeroes a line without
// deleting it); `creates.quantity` is positive (adding "0 of something" new is
// always a mistake).
export const inventoryEditSchema = z
  .object({
    updates: z
      .array(
        z.object({
          id: z.coerce.number().int().positive(),
          quantity: z.coerce.number().finite().nonnegative("Amount can't be negative"),
          unit: unitRequired,
          locationId: idOrNull,
        }),
      )
      .default([]),
    deletes: z.array(z.coerce.number().int().positive()).default([]),
    creates: z
      .array(
        z.object({
          ingredientId: z.coerce.number().int().positive("Pick an ingredient for every new line."),
          quantity: z.coerce.number().finite().positive("Amount must be greater than 0"),
          unit: unitRequired,
          locationId: idOrNull,
        }),
      )
      .default([]),
  })
  .refine((p) => p.updates.length + p.deletes.length + p.creates.length > 0, {
    message: "No changes to save.",
  });

export type InventoryEditValues = z.infer<typeof inventoryEditSchema>;

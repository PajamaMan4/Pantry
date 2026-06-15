import { z } from "zod";
import { idOrNull, unitOrNull, nullableNumber } from "./common";

export const shoppingItemSchema = z.object({
  ingredientId: idOrNull,
  name: z.string().trim().min(1, "Name is required").max(200),
  quantity: nullableNumber,
  unit: unitOrNull,
  price: nullableNumber,
});

export type ShoppingItemValues = z.infer<typeof shoppingItemSchema>;

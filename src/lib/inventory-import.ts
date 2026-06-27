import { z } from "zod";
import { normalizeUnit } from "@/lib/import/normalize-unit";

export const INVENTORY_IMPORT_VERSION = 1;

export const importItemSchema = z
  .object({
    name: z.string().min(1, "name is required"),
    cost: z.number().nonnegative().nullable().optional(),
    costUnit: z.string().nullable().optional(),
    store: z.string().nullable().optional(),
    purchasedAt: z.coerce.date().nullable().optional(),
    addQuantity: z.number().positive().nullable().optional(),
    addUnit: z.string().nullable().optional(),
    location: z.string().nullable().optional(),
  })
  .superRefine((item, ctx) => {
    const hasCost = item.cost != null;
    const hasQuantity = item.addQuantity != null;

    if (!hasCost && !hasQuantity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Item "${item.name}": must have at least one of cost or addQuantity`,
      });
      return;
    }

    if (hasCost) {
      if (!item.costUnit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Item "${item.name}": costUnit is required when cost is provided`,
        });
      } else if (!normalizeUnit(item.costUnit)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Item "${item.name}": unrecognized costUnit "${item.costUnit}"`,
        });
      }
    }

    if (hasQuantity) {
      if (!item.addUnit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Item "${item.name}": addUnit is required when addQuantity is provided`,
        });
      } else if (!normalizeUnit(item.addUnit)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Item "${item.name}": unrecognized addUnit "${item.addUnit}"`,
        });
      }
    }
  });

export const inventoryImportSchema = z.object({
  pantryVersion: z.literal(1),
  items: z.array(importItemSchema).min(1, "items array must not be empty"),
});

export type InventoryImportFile = z.infer<typeof inventoryImportSchema>;
export type InventoryImportItem = z.infer<typeof importItemSchema>;

/** Normalize a list of validated items into DB-ready items. */
export function normalizeImportItemList(
  items: InventoryImportItem[],
): import("@/lib/db/inventory").BulkImportItem[] {
  return items.map((item) => ({
    name: item.name,
    cost: item.cost ?? null,
    costUnit: item.costUnit ? (normalizeUnit(item.costUnit) ?? null) : null,
    store: item.store ?? null,
    purchasedAt: item.purchasedAt ?? null,
    addQuantity: item.addQuantity ?? null,
    addUnit: item.addUnit ? (normalizeUnit(item.addUnit) ?? null) : null,
    location: item.location ?? null,
  }));
}

/** Parse and normalize a validated file into DB-ready items. */
export function normalizeImportItems(
  file: InventoryImportFile,
): import("@/lib/db/inventory").BulkImportItem[] {
  return normalizeImportItemList(file.items);
}

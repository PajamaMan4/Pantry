import { z } from "zod";

export const cookInputSchema = z.object({
  servingsMade: z.coerce.number().positive("Servings must be greater than 0"),
});

export type CookInput = z.infer<typeof cookInputSchema>;

/** In-view ingredient swaps to apply before deducting inventory. */
export const cookSubstitutionsSchema = z
  .array(
    z.object({
      rowId: z.coerce.number().int(),
      ingredientId: z.coerce.number().int().positive(),
      amount: z.number().nullable(),
      unit: z.string().nullable(),
    }),
  )
  .default([]);

export type CookSubstitutionInput = z.infer<typeof cookSubstitutionsSchema>;

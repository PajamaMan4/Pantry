import { z } from "zod";

export const cookInputSchema = z.object({
  servingsMade: z.coerce.number().positive("Servings must be greater than 0"),
});

export type CookInput = z.infer<typeof cookInputSchema>;

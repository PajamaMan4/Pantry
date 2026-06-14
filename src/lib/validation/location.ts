import { z } from "zod";

export const locationNameSchema = z.object({
  name: z.string().trim().min(1, "Location name is required").max(60),
});

export type LocationNameValues = z.infer<typeof locationNameSchema>;

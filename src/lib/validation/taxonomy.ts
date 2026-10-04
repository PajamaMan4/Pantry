import { z } from "zod";

export const tagNameSchema = z.object({
  name: z.string().trim().min(1, "Tag name is required").max(60),
});

export const categoryNameSchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(60),
});

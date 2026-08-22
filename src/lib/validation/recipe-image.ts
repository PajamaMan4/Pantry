import { z } from "zod";

// Kept out of recipeInputSchema deliberately: that schema is a pure JSON-shape
// contract exercised directly by tests, and a Blob has no meaningful zod
// validation beyond "is it a Blob" — see the split rationale at
// src/app/settings/actions.ts for the API key, which follows the same pattern.
export const IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const ALLOWED_IMAGE_MIME = ["image/webp", "image/jpeg", "image/png"] as const;

export const recipeImageEditSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("keep") }),
  z.object({ action: z.literal("remove") }),
  z.object({
    action: z.literal("set"),
    blob: z.custom<Blob>((v) => typeof Blob !== "undefined" && v instanceof Blob, "Invalid image."),
    mime: z.enum(ALLOWED_IMAGE_MIME),
    width: z.number().int().positive().max(10000).nullable(),
    height: z.number().int().positive().max(10000).nullable(),
  }),
]);

export type RecipeImageEditInput = z.infer<typeof recipeImageEditSchema>;

/**
 * Magic-number sniff of the actual bytes. The client-declared mime is advisory
 * only — this is authoritative, and is what actually gets stored/served. SVG is
 * deliberately never accepted anywhere in this pipeline: an SVG served inline
 * from the app's own origin would be a stored-XSS vector.
 */
export function sniffImageMime(b: Buffer): (typeof ALLOWED_IMAGE_MIME)[number] | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b.length >= 8 &&
    b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return "image/png";
  if (
    b.length >= 12 &&
    b.subarray(0, 4).toString("ascii") === "RIFF" &&
    b.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "image/webp";
  return null;
}

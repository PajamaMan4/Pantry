import { z } from "zod";

// Treat "", null, undefined uniformly as "absent" for optional fields coming
// from form inputs.
const isBlank = (v: unknown) => v === "" || v === null || v === undefined;

/** Trimmed string or null (empty -> null). */
export const nullableText = z.preprocess(
  (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : (v ?? null)),
  z.string().nullable(),
);

/** Non-negative number or null (blank -> null). */
export const nullableNumber = z.preprocess(
  (v) => (isBlank(v) ? null : v),
  z.coerce.number().finite().nonnegative().nullable(),
);

/** Non-negative integer or null (blank -> null). */
export const nullableInt = z.preprocess(
  (v) => (isBlank(v) ? null : v),
  z.coerce.number().int().nonnegative().nullable(),
);

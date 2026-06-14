import { z } from "zod";
import { UNIT_IDS } from "@/lib/domain/units";

// Treat "", null, undefined uniformly as "absent" for optional fields coming
// from form inputs.
const isBlank = (v: unknown) => v === "" || v === null || v === undefined;

/** Positive integer id or null (blank -> null). */
export const idOrNull = z.preprocess(
  (v) => (isBlank(v) ? null : v),
  z.coerce.number().int().positive().nullable(),
);

/** A valid unit id, or null (blank -> null). */
export const unitOrNull = z.preprocess(
  (v) => (isBlank(v) ? null : v),
  z.enum(UNIT_IDS as [string, ...string[]]).nullable(),
);

/** A required, valid unit id. */
export const unitRequired = z.enum(UNIT_IDS as [string, ...string[]]);

/** Date or null (blank -> null). Accepts "YYYY-MM-DD" from <input type="date">. */
export const nullableDate = z.preprocess(
  (v) => (isBlank(v) ? null : v),
  z.coerce.date().nullable(),
);

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

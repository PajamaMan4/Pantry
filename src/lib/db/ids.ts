import { nanoid } from "nanoid";

/**
 * A globally-unique, sync-stable identifier that travels with a row across
 * databases. Local integer PKs are fine for joins within one database, but two
 * independent databases (e.g. a phone + the PC) both mint colliding autoincrement
 * ids — so a future sync matches rows by `publicId`, not by `id`. The format is
 * irrelevant; only uniqueness matters. nanoid is already used for step ids.
 */
export function newPublicId(): string {
  return nanoid();
}

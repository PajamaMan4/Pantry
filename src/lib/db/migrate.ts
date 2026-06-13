import fs from "node:fs";
import path from "node:path";
import type BetterSqlite3 from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

export const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

/**
 * Apply any pending Drizzle migrations to an open connection.
 *
 * Idempotent: drizzle tracks applied migrations in a `__drizzle_migrations`
 * table, so calling this repeatedly (e.g. on every dev hot-reload) is safe.
 * No-ops if migrations haven't been generated yet (no `meta/_journal.json`).
 */
export function applyMigrations(sqlite: BetterSqlite3.Database): void {
  const journal = path.join(MIGRATIONS_DIR, "meta", "_journal.json");
  if (!fs.existsSync(journal)) {
    console.warn(
      `[db] No migrations found at ${MIGRATIONS_DIR}. Run \`npm run db:generate\` first.`,
    );
    return;
  }
  migrate(drizzle(sqlite), { migrationsFolder: MIGRATIONS_DIR });
}

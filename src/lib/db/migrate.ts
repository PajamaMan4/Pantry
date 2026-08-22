import fs from "node:fs";
import path from "node:path";
import type BetterSqlite3 from "better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";

export const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

const MIGRATIONS_TABLE = "__drizzle_migrations";

function latestAppliedMillis(sqlite: BetterSqlite3.Database): number {
  const row = sqlite
    .prepare(
      `SELECT created_at FROM ${MIGRATIONS_TABLE} ORDER BY created_at DESC LIMIT 1`,
    )
    .get() as { created_at: number } | undefined;
  return row ? Number(row.created_at) : -1;
}

/**
 * Apply any pending Drizzle migrations to an open connection.
 *
 * Idempotent AND safe under concurrent callers: Next's `next build` forks
 * several static-generation workers, each of which imports `client.ts` and so
 * each calls this on its own connection to the same file. drizzle's own
 * `migrate()` checks "what's the latest applied migration?" *before* opening
 * its transaction, so two processes can both see themselves as first, both
 * proceed, and the loser gets a "table already exists" once it acquires the
 * write lock and replays a migration the winner already applied.
 *
 * We inline the same bookkeeping (same `__drizzle_migrations` table/columns,
 * same `folderMillis` comparison, so existing rows and drizzle-kit are
 * unaffected) but move the check *inside* a `BEGIN IMMEDIATE` transaction.
 * `BEGIN IMMEDIATE` grabs SQLite's write lock up front and honours
 * `busy_timeout`, so a second process blocks there, and by the time it gets
 * the lock its re-read of the latest migration reflects the winner's commit —
 * it correctly sees nothing left to do.
 *
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

  const migrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_DIR });

  sqlite.exec(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
			id SERIAL PRIMARY KEY,
			hash text NOT NULL,
			created_at numeric
		)`,
  );

  // Fast path: the common case (every dev hot-reload, every build worker once
  // one of them has already migrated) is that nothing is pending. Skip taking
  // the write lock entirely when a plain read already proves that.
  const latestMillis = Math.max(0, ...migrations.map((m) => m.folderMillis));
  if (latestAppliedMillis(sqlite) >= latestMillis) return;

  // Slow path: something might be pending. Serialize on SQLite's write lock so
  // that whichever process gets here first is the only one that applies
  // anything; busy_timeout makes everyone else wait rather than error.
  const priorBusyTimeout = sqlite.pragma("busy_timeout", { simple: true }) as number;
  sqlite.pragma("busy_timeout = 30000");
  try {
    sqlite.exec("BEGIN IMMEDIATE");
    try {
      const last = latestAppliedMillis(sqlite); // re-read under the lock
      const insert = sqlite.prepare(
        `INSERT INTO ${MIGRATIONS_TABLE} (hash, created_at) VALUES (?, ?)`,
      );
      for (const migration of migrations) {
        if (migration.folderMillis <= last) continue;
        for (const stmt of migration.sql) sqlite.exec(stmt);
        insert.run(migration.hash, migration.folderMillis);
      }
      sqlite.exec("COMMIT");
    } catch (err) {
      sqlite.exec("ROLLBACK");
      throw err;
    }
  } finally {
    sqlite.pragma(`busy_timeout = ${priorBusyTimeout}`);
  }
}

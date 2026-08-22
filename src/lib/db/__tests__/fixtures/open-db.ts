/**
 * Fixture for migrate-concurrency.test.ts. Spun up as its own child process
 * (not run by Vitest directly) so it gets its own SQLite connection — mirroring
 * how each `next build` static-generation worker independently opens a
 * connection and calls `applyMigrations()` against the same database file.
 *
 * All module loading (better-sqlite3's native binding, drizzle, reading the
 * migration files off disk) happens up front, *before* the synchronized start
 * line. Only the connection-open + migrate step — the actual race — is gated
 * on `MIGRATE_START_AT`, so sibling processes hit SQLite at close to the same
 * instant instead of the race window getting swallowed by unrelated
 * per-process import/compile jitter.
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { applyMigrations } from "../../migrate";
import { DB_PATH } from "../../paths";

const startAt = Number(process.env.MIGRATE_START_AT);
while (Date.now() < startAt) {
  // busy-wait for a shared start line; only ever spins for ~hundreds of ms
}

try {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  applyMigrations(sqlite);
  sqlite.close();
  console.log("OK");
} catch (err) {
  console.error(err);
  process.exit(1);
}

import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { applyMigrations } from "./migrate";
import { DB_PATH } from "./paths";

export { DB_PATH };

type Drizzle = ReturnType<typeof drizzle<typeof schema>>;

function createConnection(): Database.Database {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  // WAL mode is crash-safe and allows concurrent reads while writing (§4.5).
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  // Bring the schema up to date on first connection (idempotent).
  applyMigrations(sqlite);
  return sqlite;
}

// Reuse a single connection across Next.js dev hot-reloads to avoid leaking
// file handles / re-running migrations on every module refresh. We hold the
// live handle + drizzle wrapper in a mutable cell so the connection can be
// swapped out (e.g. after an in-app restore — see maintenance.ts) without every
// importer of `db` capturing a stale reference.
type DbCell = { sqlite: Database.Database; orm: Drizzle };

const globalForDb = globalThis as unknown as { __pantryDb?: DbCell };

function openCell(): DbCell {
  const sqlite = createConnection();
  return { sqlite, orm: drizzle(sqlite, { schema }) };
}

const cell: DbCell = globalForDb.__pantryDb ?? openCell();
if (process.env.NODE_ENV !== "production") {
  globalForDb.__pantryDb = cell;
}

/** The current raw better-sqlite3 handle (for backup/restore/PRAGMA work). */
export function getRawSqlite(): Database.Database {
  return cell.sqlite;
}

/**
 * Replace the live database file with the one at `srcPath`, then reopen. Used by
 * the in-app restore flow: we checkpoint + close the current handle (so the file
 * is unlocked on Windows), copy the new file into place, drop any stale WAL/SHM
 * sidecars, and reconnect. The exported `db` Proxy below always forwards to the
 * current handle, so existing importers keep working across the swap.
 */
export function replaceDatabaseFile(srcPath: string): void {
  try {
    cell.sqlite.pragma("wal_checkpoint(TRUNCATE)");
  } catch {
    /* ignore */
  }
  try {
    cell.sqlite.close();
  } catch {
    /* already closed */
  }
  fs.copyFileSync(srcPath, DB_PATH);
  for (const suffix of ["-wal", "-shm"]) {
    const sidecar = DB_PATH + suffix;
    if (fs.existsSync(sidecar)) fs.rmSync(sidecar, { force: true });
  }
  const fresh = openCell();
  cell.sqlite = fresh.sqlite;
  cell.orm = fresh.orm;
}

// `db` forwards every access to the current drizzle instance. Methods are bound
// so `this` stays correct after a reconnect swaps `cell.orm`.
export const db = new Proxy({} as Drizzle, {
  get(_target, prop, receiver) {
    const value = Reflect.get(cell.orm, prop, receiver);
    return typeof value === "function" ? value.bind(cell.orm) : value;
  },
}) as Drizzle;

export type DB = typeof db;

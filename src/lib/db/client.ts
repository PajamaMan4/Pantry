import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { applyMigrations } from "./migrate";
import { DB_PATH } from "./paths";

export { DB_PATH };

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
// file handles / re-running migrations on every module refresh.
const globalForDb = globalThis as unknown as {
  __pantrySqlite?: Database.Database;
};

export const sqlite: Database.Database =
  globalForDb.__pantrySqlite ?? createConnection();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__pantrySqlite = sqlite;
}

export const db = drizzle(sqlite, { schema });

export type DB = typeof db;

import path from "node:path";

// Side-effect-free path config shared by the runtime client and the scripts.
// Single SQLite file on disk (§1.2); override with PANTRY_DB_PATH for tests.
export const DB_PATH =
  process.env.PANTRY_DB_PATH ?? path.join(process.cwd(), "data", "pantry.db");

export const BACKUPS_DIR = path.join(path.dirname(DB_PATH), "backups");

/**
 * Apply pending migrations to data/pantry.db and report the resulting schema.
 * Run with: npm run db:migrate
 *
 * Importing the client opens the connection (WAL) and applies migrations as a
 * side effect; we then list the tables so the developer can see it worked.
 */
import { sql } from "drizzle-orm";
import { db, DB_PATH } from "../src/lib/db/client";

const rows = db.all<{ name: string }>(
  sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_\\_%' ESCAPE '\\' ORDER BY name`,
);

console.log(`[db] Migrated ${DB_PATH}`);
console.log(`[db] ${rows.length} tables:`);
for (const r of rows) console.log(`  - ${r.name}`);

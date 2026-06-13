/**
 * Timestamped backup of the SQLite database (§4.5).
 *
 * Copies data/pantry.db -> data/backups/pantry-YYYYMMDD-HHmmss.db using SQLite's
 * online backup API (consistent even if a writer holds the WAL), then prunes to
 * the newest N backups. Run with: npm run backup  (or on app start / daily).
 *
 * Keep count is configurable via BACKUP_KEEP (default 10).
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { DB_PATH, BACKUPS_DIR } from "../src/lib/db/paths";

const KEEP = Math.max(1, Number(process.env.BACKUP_KEEP ?? 10));
const FILE_RE = /^pantry-\d{8}-\d{6}\.db$/;

const pad = (n: number) => String(n).padStart(2, "0");
function stamp(d = new Date()): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`[backup] No database at ${DB_PATH}. Run \`npm run db:migrate\` first.`);
    process.exit(1);
  }

  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  const dest = path.join(BACKUPS_DIR, `pantry-${stamp()}.db`);

  const src = new Database(DB_PATH, { readonly: true });
  try {
    await src.backup(dest);
  } finally {
    src.close();
  }

  // The stamp format sorts lexicographically == chronologically.
  const files = fs.readdirSync(BACKUPS_DIR).filter((f) => FILE_RE.test(f)).sort();
  const excess = files.slice(0, Math.max(0, files.length - KEEP));
  for (const f of excess) fs.rmSync(path.join(BACKUPS_DIR, f));

  console.log(`[backup] Wrote ${dest}`);
  console.log(
    `[backup] Keeping ${Math.min(files.length, KEEP)} backup(s)` +
      (excess.length ? `; pruned ${excess.length} old.` : "."),
  );
}

main().catch((e) => {
  console.error("[backup] Failed:", e);
  process.exit(1);
});

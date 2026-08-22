import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";
import { afterEach, expect, it } from "vitest";

// Reproduces the race behind the "table already exists" build failure:
// several processes (Next's `next build` static-generation workers, in
// practice) each import `client.ts` and so each call `applyMigrations()`
// against the same fresh database file at nearly the same instant.
//
// This spawns real child processes rather than simulating concurrency inside
// one process, because the race lives in SQLite's file-level locking between
// separate connections — an in-process fake wouldn't exercise the same path.

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../../..");
const fixture = path.join(testDir, "fixtures", "open-db.ts");
const tsxCli = require.resolve("tsx/cli");

const WORKERS = 4;

let tmpDir: string | undefined;

afterEach(() => {
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  tmpDir = undefined;
});

function runWorker(dbPath: string, startAt: number): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [tsxCli, fixture], {
      cwd: repoRoot,
      env: { ...process.env, PANTRY_DB_PATH: dbPath, MIGRATE_START_AT: String(startAt) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stderr }));
  });
}

it(
  "applies each migration exactly once when several processes race to migrate a fresh db",
  async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pantry-migrate-race-"));
    const dbPath = path.join(tmpDir, "pantry.db");

    // Give every worker the same start line so they all hit applyMigrations()
    // together instead of naturally staggering.
    const startAt = Date.now() + 300;
    const results = await Promise.all(
      Array.from({ length: WORKERS }, () => runWorker(dbPath, startAt)),
    );

    for (const { code, stderr } of results) {
      expect(stderr).not.toMatch(/already exists/i);
      expect(code, `worker failed:\n${stderr}`).toBe(0);
    }

    const journal = JSON.parse(
      fs.readFileSync(path.join(repoRoot, "drizzle", "meta", "_journal.json"), "utf8"),
    ) as { entries: unknown[] };

    const check = new Database(dbPath, { readonly: true });
    try {
      const migrationRows = check
        .prepare("SELECT COUNT(*) AS n FROM __drizzle_migrations")
        .get() as { n: number };
      // Exactly one row per migration file — not zero (nobody migrated) and
      // not more than the journal's entry count (double-applied).
      expect(migrationRows.n).toBe(journal.entries.length);

      const table = check
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'recipe_images'")
        .get();
      expect(table).toBeDefined();
    } finally {
      check.close();
    }
  },
  30_000,
);

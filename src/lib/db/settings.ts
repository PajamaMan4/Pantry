import { eq } from "drizzle-orm";
import { db } from "./client";
import { settings, type Settings } from "./schema";
import type { SettingsUpdate } from "../validation/settings";

const SETTINGS_ID = 1;

/**
 * Read the single settings row, creating it with defaults if it doesn't exist
 * yet (so the app works even before `npm run db:seed`).
 */
export function getSettings(): Settings {
  const existing = db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).get();
  if (existing) return existing;

  db.insert(settings).values({ id: SETTINGS_ID }).onConflictDoNothing().run();
  return db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).get()!;
}

export function updateSettings(values: SettingsUpdate): Settings {
  return db
    .update(settings)
    .set(values)
    .where(eq(settings.id, SETTINGS_ID))
    .returning()
    .get();
}

export type InventoryView = "alphabetical" | "location";

export function setInventoryView(view: InventoryView): void {
  getSettings(); // ensure the row exists
  db.update(settings).set({ inventoryView: view }).where(eq(settings.id, SETTINGS_ID)).run();
}

export function setAnthropicApiKey(key: string | null): void {
  getSettings(); // ensure the row exists
  db.update(settings).set({ anthropicApiKey: key }).where(eq(settings.id, SETTINGS_ID)).run();
}

/**
 * Resolve the Anthropic API key for recipe import: the key saved in Settings
 * takes precedence, falling back to the ANTHROPIC_API_KEY environment variable.
 */
export function resolveAnthropicApiKey(): string | null {
  const stored = getSettings().anthropicApiKey?.trim();
  if (stored) return stored;
  const env = process.env.ANTHROPIC_API_KEY?.trim();
  return env || null;
}

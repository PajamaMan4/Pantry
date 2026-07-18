import { connection } from "next/server";
import { getSettings } from "@/lib/db/settings";
import { WelcomeDialog } from "./welcome-dialog";

/**
 * Reads the `hasSeenWelcome` flag on the server and shows the first-run dialog
 * only when it hasn't been seen. Keeping the read here keeps DB access out of
 * the client bundle.
 *
 * `await connection()` excludes this from prerendering: better-sqlite3 is a
 * synchronous driver, so without it the flag would be baked in at build time on
 * statically rendered routes (e.g. the guide page) and the dialog could reappear
 * after being dismissed.
 */
export async function WelcomeGate() {
  await connection();
  const { hasSeenWelcome } = getSettings();
  if (hasSeenWelcome) return null;
  return <WelcomeDialog />;
}

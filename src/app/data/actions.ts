"use server";

import { revalidatePath } from "next/cache";
import { backupNow, restoreFromBackup } from "@/lib/db/maintenance";

export type BackupActionResult = { ok: true; name: string } | { ok: false; error: string };
export type RestoreActionResult = { ok: true } | { ok: false; error: string };

export async function backupNowAction(): Promise<BackupActionResult> {
  try {
    const backup = await backupNow();
    revalidatePath("/data");
    return { ok: true, name: backup.name };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Backup failed." };
  }
}

export async function restoreBackupAction(name: string): Promise<RestoreActionResult> {
  try {
    await restoreFromBackup(name);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Restore failed." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

import { revalidatePath } from "next/cache";
import { restoreFromBytes } from "@/lib/db/maintenance";

// Restore from an uploaded .db file. A route handler (not a server action) so the
// upload isn't capped by the server-action body-size limit.
export const dynamic = "force-dynamic";

const MAX_BYTES = 256 * 1024 * 1024; // 256 MB — generous for a local SQLite file

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ ok: false, error: "Choose a .db file to restore." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ ok: false, error: "That file is too large." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    await restoreFromBytes(bytes);
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "Restore failed." },
      { status: 400 },
    );
  }

  // Everything could have changed — blow away the whole cache.
  revalidatePath("/", "layout");
  return Response.json({ ok: true });
}

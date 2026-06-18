import { snapshotBytes, exportFilename, toArrayBuffer } from "@/lib/db/maintenance";

// Always produce a fresh snapshot of the live database.
export const dynamic = "force-dynamic";

export async function GET() {
  const bytes = await snapshotBytes();
  return new Response(toArrayBuffer(bytes), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${exportFilename()}"`,
      "Content-Length": String(bytes.length),
    },
  });
}

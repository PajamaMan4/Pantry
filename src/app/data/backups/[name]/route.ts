import { readBackup, toArrayBuffer } from "@/lib/db/maintenance";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  try {
    const bytes = readBackup(name);
    return new Response(toArrayBuffer(bytes), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Content-Length": String(bytes.length),
      },
    });
  } catch {
    return new Response("Backup not found", { status: 404 });
  }
}

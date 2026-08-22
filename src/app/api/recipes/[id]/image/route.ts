import { getRecipeImageBytes } from "@/lib/db/recipe-images";

// Bytes live in SQLite; always read live. The `?v=<updatedAt epoch>` query param
// the client appends (see recipeImageSrc) is a pure cache key this handler ignores
// — it's what lets us mark the response immutable while a replaced image still
// gets fetched under a brand-new URL instead of being served stale.
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipeId = Number(id);
  if (!Number.isInteger(recipeId) || recipeId <= 0) {
    return new Response(null, { status: 404 });
  }

  const row = getRecipeImageBytes(recipeId);
  if (!row) return new Response(null, { status: 404 });

  const etag = `"${recipeId}-${row.updatedAt.getTime()}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  // Copy into a plain Uint8Array: better-sqlite3 can hand back a Buffer backed by
  // a pooled (and possibly Shared) ArrayBuffer, which the DOM Blob/Response types
  // don't accept directly.
  const body = new Blob([new Uint8Array(row.bytes)]);

  return new Response(body, {
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(row.bytes.byteLength),
      "Content-Disposition": "inline",
      // Never let a browser sniff a stored blob into something executable.
      "X-Content-Type-Options": "nosniff",
      ETag: etag,
      // Safe only because the URL carries the version-stamped ?v= query param.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

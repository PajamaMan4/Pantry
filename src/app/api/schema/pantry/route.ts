import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

export function GET() {
  const content = readFileSync(join(process.cwd(), "src/lib/pantry-file.ts"), "utf-8");
  return new Response(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pantry-file.ts"',
    },
  });
}

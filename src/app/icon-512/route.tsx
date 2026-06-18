import { renderAppIcon } from "@/lib/icon";

export const dynamic = "force-static";

export function GET() {
  return renderAppIcon(512);
}

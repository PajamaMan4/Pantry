import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { pageWindow, type PageInfo } from "@/lib/domain/pagination";
import { cn } from "@/lib/utils";

// Server component on purpose: `buildHref` is a function prop, which is only
// legal because nothing here crosses a client boundary. Do not add "use client".
export function RecipePagination({
  info,
  buildHref,
}: {
  info: PageInfo;
  buildHref: (page: number) => string;
}) {
  if (info.totalPages <= 1) return null;

  const tokens = pageWindow(info.page, info.totalPages);
  // Same shape as the sort segmented control on the recipes page.
  const item = "rounded-sm px-2.5 py-1 font-medium transition-colors";
  const step = "inline-flex items-center gap-1";

  return (
    <nav
      aria-label="Recipe pages"
      className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs"
    >
      <div className="flex items-center gap-1 rounded-md border p-0.5">
        {info.hasPrev ? (
          <Link
            href={buildHref(info.page - 1)}
            rel="prev"
            aria-label="Previous page"
            className={cn(item, step, "text-muted-foreground hover:text-foreground")}
          >
            <ChevronLeftIcon className="size-3.5" /> Prev
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className={cn(item, step, "text-muted-foreground opacity-50")}
          >
            <ChevronLeftIcon className="size-3.5" /> Prev
          </span>
        )}

        {tokens.map((token, i) =>
          token === "gap" ? (
            <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-muted-foreground">
              …
            </span>
          ) : (
            <Link
              key={token}
              href={buildHref(token)}
              aria-label={`Page ${token}`}
              aria-current={token === info.page ? "page" : undefined}
              className={cn(
                item,
                token === info.page
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {token}
            </Link>
          ),
        )}

        {info.hasNext ? (
          <Link
            href={buildHref(info.page + 1)}
            rel="next"
            aria-label="Next page"
            className={cn(item, step, "text-muted-foreground hover:text-foreground")}
          >
            Next <ChevronRightIcon className="size-3.5" />
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className={cn(item, step, "text-muted-foreground opacity-50")}
          >
            Next <ChevronRightIcon className="size-3.5" />
          </span>
        )}
      </div>
    </nav>
  );
}

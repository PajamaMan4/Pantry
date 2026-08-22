// Generic list pagination, shared by the recipes grid and the ingredients
// dictionary view. Pure + tested.
//
// The recipes page paginates *collapsed rows* (tiles), not raw recipes, so a
// variant group is never split across a page boundary — see ./variants.ts.
// The ingredients dictionary paginates plain rows, one per ingredient.
//
// Out-of-range pages clamp rather than redirect: a redirect would rewrite the
// URL underneath the user and trap the Back button on a stale `?page=`.

export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];
export const DEFAULT_PAGE_SIZE: PageSize = 10;

export type PageInfo = {
  page: number; // 1-based, clamped into [1, totalPages]
  pageSize: number;
  totalItems: number;
  totalPages: number; // always >= 1, even for an empty list
  startIndex: number; // 0-based inclusive -> items.slice(startIndex, endIndex)
  endIndex: number; // 0-based exclusive
  from: number; // 1-based human range start; 0 when empty
  to: number; // 1-based human range end; 0 when empty
  hasPrev: boolean;
  hasNext: boolean;
};

/** Coerce a `?page=` query value. Rejects blank, non-numeric, zero, negative, fractional. */
export function parsePageParam(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return undefined;
  return n;
}

/** Clamp a stored page-size setting to a supported option. */
export function resolvePageSize(value: number | null | undefined): PageSize {
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(value ?? NaN)
    ? (value as PageSize)
    : DEFAULT_PAGE_SIZE;
}

export function paginate(
  totalItems: number,
  pageSize: number,
  requestedPage?: number,
): PageInfo {
  const size = Math.max(1, Math.floor(pageSize) || DEFAULT_PAGE_SIZE);
  const total = Math.max(0, Math.floor(totalItems) || 0);
  const totalPages = Math.max(1, Math.ceil(total / size));
  // parsePageParam never yields NaN/Infinity, but a direct caller could.
  const asked = Number.isFinite(requestedPage) ? Math.floor(requestedPage as number) : 1;
  const page = Math.min(Math.max(asked, 1), totalPages);
  const startIndex = (page - 1) * size;
  const endIndex = Math.min(startIndex + size, total);

  return {
    page,
    pageSize: size,
    totalItems: total,
    totalPages,
    startIndex,
    endIndex,
    from: total === 0 ? 0 : startIndex + 1,
    to: endIndex,
    hasPrev: page > 1,
    hasNext: page < totalPages,
  };
}

export type PageToken = number | "gap";

/**
 * Numbers to render in the pagination strip: the first page, the last page, and
 * the current page's neighbours, with "gap" (…) standing in for elided runs.
 * `maxLinks` is a soft cap; a gap is never emitted in place of exactly one page.
 */
export function pageWindow(page: number, totalPages: number, maxLinks = 7): PageToken[] {
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  if (totalPages <= maxLinks) return range(1, totalPages);

  const wanted = new Set<number>([1, totalPages]);
  // 3 consecutive numbers around the current page, shifted inward at the ends so
  // the strip never collapses to "1 … 12".
  const start = Math.min(Math.max(page - 1, 2), totalPages - 3);
  for (let p = start; p < start + 3; p++) wanted.add(p);

  const out: PageToken[] = [];
  for (const p of [...wanted].sort((a, b) => a - b)) {
    const prev = out.at(-1);
    if (typeof prev === "number") {
      if (p - prev === 2) out.push(prev + 1); // don't hide exactly one page
      else if (p - prev > 2) out.push("gap");
    }
    out.push(p);
  }
  return out;
}

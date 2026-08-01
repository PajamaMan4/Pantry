import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  pageWindow,
  paginate,
  parsePageParam,
  resolvePageSize,
  type PageToken,
} from "@/lib/domain/pagination";

describe("parsePageParam", () => {
  it("returns undefined for missing or blank values", () => {
    expect(parsePageParam(undefined)).toBeUndefined();
    expect(parsePageParam("")).toBeUndefined();
  });

  it("rejects non-numeric, zero, negative and fractional values", () => {
    expect(parsePageParam("abc")).toBeUndefined();
    expect(parsePageParam("0")).toBeUndefined();
    expect(parsePageParam("-3")).toBeUndefined();
    expect(parsePageParam("2.5")).toBeUndefined();
  });

  it("accepts positive integers, ignoring surrounding whitespace", () => {
    expect(parsePageParam("3")).toBe(3);
    expect(parsePageParam(" 3 ")).toBe(3);
  });
});

describe("resolvePageSize", () => {
  it("passes supported options through", () => {
    expect(resolvePageSize(10)).toBe(10);
    expect(resolvePageSize(25)).toBe(25);
    expect(resolvePageSize(50)).toBe(50);
  });

  it("falls back to the default for anything else", () => {
    for (const bad of [7, 0, -1, NaN, undefined, null]) {
      expect(resolvePageSize(bad)).toBe(DEFAULT_PAGE_SIZE);
    }
  });
});

describe("paginate", () => {
  it("handles an empty list", () => {
    const info = paginate(0, 10);
    expect(info).toMatchObject({
      page: 1,
      totalPages: 1,
      startIndex: 0,
      endIndex: 0,
      from: 0,
      to: 0,
      hasPrev: false,
      hasNext: false,
    });
  });

  it("describes the first page", () => {
    expect(paginate(42, 10)).toMatchObject({
      page: 1,
      totalPages: 5,
      startIndex: 0,
      endIndex: 10,
      from: 1,
      to: 10,
      hasPrev: false,
      hasNext: true,
    });
  });

  it("describes a middle page", () => {
    expect(paginate(42, 10, 2)).toMatchObject({
      page: 2,
      startIndex: 10,
      endIndex: 20,
      from: 11,
      to: 20,
      hasPrev: true,
      hasNext: true,
    });
  });

  it("describes a partial last page", () => {
    expect(paginate(42, 10, 5)).toMatchObject({
      page: 5,
      startIndex: 40,
      endIndex: 42,
      from: 41,
      to: 42,
      hasNext: false,
    });
  });

  it("describes an exactly-full last page", () => {
    expect(paginate(20, 10, 2)).toMatchObject({
      page: 2,
      totalPages: 2,
      startIndex: 10,
      endIndex: 20,
      to: 20,
      hasNext: false,
    });
  });

  it("has no prev/next on a single full page", () => {
    expect(paginate(10, 10, 1)).toMatchObject({
      totalPages: 1,
      hasPrev: false,
      hasNext: false,
    });
  });

  it("clamps a page above the last one", () => {
    expect(paginate(42, 10, 99)).toMatchObject({ page: 5, from: 41, to: 42 });
  });

  it("clamps a page below the first one", () => {
    expect(paginate(42, 10, 0).page).toBe(1);
    expect(paginate(42, 10, -5).page).toBe(1);
  });

  it("falls back to page 1 for a non-finite requested page", () => {
    // Guards the Math.min(NaN, …) trap, which would otherwise yield NaN indices.
    expect(paginate(42, 10, NaN).page).toBe(1);
    expect(paginate(42, 10, Infinity).page).toBe(1);
  });

  it("collapses to one page when the size exceeds the total", () => {
    expect(paginate(42, 50, 1)).toMatchObject({ totalPages: 1, endIndex: 42, to: 42 });
  });

  it("does not divide by zero on a bogus page size", () => {
    const info = paginate(42, 0, 1);
    expect(Number.isFinite(info.totalPages)).toBe(true);
    expect(info.pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it("partitions the list exactly across all pages", () => {
    const items = Array.from({ length: 42 }, (_, i) => i);
    const seen: number[] = [];
    for (let p = 1; p <= paginate(items.length, 10).totalPages; p++) {
      const info = paginate(items.length, 10, p);
      seen.push(...items.slice(info.startIndex, info.endIndex));
    }
    expect(seen).toEqual(items);
  });
});

describe("pageWindow", () => {
  it("lists every page when they all fit", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("elides trailing pages near the start", () => {
    expect(pageWindow(1, 12)).toEqual([1, 2, 3, 4, "gap", 12]);
  });

  it("elides both sides in the middle", () => {
    expect(pageWindow(5, 12)).toEqual([1, "gap", 4, 5, 6, "gap", 12]);
  });

  it("elides leading pages near the end", () => {
    expect(pageWindow(12, 12)).toEqual([1, "gap", 9, 10, 11, 12]);
  });

  it("never hides exactly one page behind a gap", () => {
    expect(pageWindow(4, 8)).toEqual([1, 2, 3, 4, 5, "gap", 8]);
  });

  it("holds its invariants across every page of every size", () => {
    const isNumber = (t: PageToken): t is number => typeof t === "number";
    for (let totalPages = 1; totalPages <= 20; totalPages++) {
      for (let page = 1; page <= totalPages; page++) {
        const tokens = pageWindow(page, totalPages);
        const numbers = tokens.filter(isNumber);
        const label = `page ${page} of ${totalPages}`;

        expect(numbers, label).toEqual([...numbers].sort((a, b) => a - b));
        expect(new Set(numbers).size, label).toBe(numbers.length);
        expect(numbers, label).toContain(1);
        expect(numbers, label).toContain(totalPages);
        expect(numbers, label).toContain(page);
        for (let i = 1; i < tokens.length; i++) {
          expect(tokens[i] === "gap" && tokens[i - 1] === "gap", label).toBe(false);
        }
      }
    }
  });
});

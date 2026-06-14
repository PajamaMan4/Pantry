import { describe, expect, it } from "vitest";
import { normalizePrices, priceSummary, unitPrice } from "@/lib/domain/cost";

const FLOUR = { defaultUnit: "g", density: 0.53 };

describe("normalizePrices", () => {
  it("normalizes entries to price per default unit and drops unconvertible ones", () => {
    const n = normalizePrices(
      [
        { price: 3.49, quantity: 2, unit: "kg", purchasedAt: new Date("2026-01-01") },
        { price: 0.5, quantity: 100, unit: "g", purchasedAt: new Date("2026-03-01") },
        { price: 1, quantity: 1, unit: "each", purchasedAt: new Date("2026-03-15") }, // each→g unconvertible
      ],
      { defaultUnit: "g" },
    );
    expect(n).toHaveLength(2);
    expect(n[0].perDefaultUnit).toBeCloseTo(0.001745, 6); // 3.49/2/1000
    expect(n[1].perDefaultUnit).toBeCloseTo(0.005, 6);
  });

  it("bridges volume→mass with density", () => {
    const n = normalizePrices(
      [{ price: 2, quantity: 1, unit: "cup", purchasedAt: new Date("2026-03-01") }],
      FLOUR,
    );
    // 1 cup flour ≈ 125.39 g → $2 / 125.39 ≈ 0.01595 / g
    expect(n[0].perDefaultUnit).toBeCloseTo(0.01595, 4);
  });

  it("returns [] when the ingredient has no default unit", () => {
    expect(normalizePrices([{ price: 1, quantity: 1, unit: "g", purchasedAt: new Date() }], { defaultUnit: null })).toEqual([]);
  });
});

describe("priceSummary", () => {
  const now = new Date("2026-06-13");

  it("computes range, average and latest within the window", () => {
    const s = priceSummary(
      [
        { price: 3.49, quantity: 2, unit: "kg", purchasedAt: new Date("2026-01-01") },
        { price: 0.5, quantity: 100, unit: "g", purchasedAt: new Date("2026-03-01") },
      ],
      { defaultUnit: "g" },
      6,
      now,
    );
    expect(s.count).toBe(2);
    expect(s.windowed).toBe(true);
    expect(s.min).toBeCloseTo(0.001745, 6);
    expect(s.max).toBeCloseTo(0.005, 6);
    expect(s.average).toBeCloseTo(0.0033725, 6);
    expect(s.latest).toBeCloseTo(0.005, 6); // Mar entry is most recent
    expect(s.points).toHaveLength(2);
  });

  it("a single entry yields no misleading range (min=max=latest)", () => {
    const s = priceSummary(
      [{ price: 4, quantity: 1, unit: "kg", purchasedAt: new Date("2026-05-01") }],
      { defaultUnit: "g" },
      6,
      now,
    );
    expect(s.min).toBe(s.max);
    expect(s.average).toBe(s.latest);
    expect(s.count).toBe(1);
  });

  it("falls back to all-time when the window has no entries", () => {
    const s = priceSummary(
      [{ price: 4, quantity: 1, unit: "kg", purchasedAt: new Date("2024-01-01") }],
      { defaultUnit: "g" },
      6,
      now,
    );
    expect(s.windowed).toBe(false);
    expect(s.count).toBe(1);
  });

  it("is empty when there are no entries", () => {
    const s = priceSummary([], { defaultUnit: "g" }, 6, now);
    expect(s).toMatchObject({ count: 0, min: null, max: null, average: null, latest: null });
  });
});

describe("unitPrice", () => {
  const now = new Date("2026-06-13");
  const entries = [
    { price: 2, quantity: 1, unit: "kg", purchasedAt: new Date("2026-01-01") }, // 0.002 /g
    { price: 4, quantity: 1, unit: "kg", purchasedAt: new Date("2026-05-01") }, // 0.004 /g
  ];

  it("current → most recent normalized price", () => {
    expect(unitPrice(entries, { defaultUnit: "g" }, "current", 6, now)).toBeCloseTo(0.004, 6);
  });

  it("average → mean over the window", () => {
    expect(unitPrice(entries, { defaultUnit: "g" }, "average", 6, now)).toBeCloseTo(0.003, 6);
  });

  it("returns null with no usable entries", () => {
    expect(unitPrice([], { defaultUnit: "g" }, "average", 6, now)).toBeNull();
  });
});

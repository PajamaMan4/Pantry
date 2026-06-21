import { describe, expect, it } from "vitest";
import {
  normalizePrices,
  priceSummary,
  unitPrice,
  recipeCost,
  type CostIngredient,
} from "@/lib/domain/cost";

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

describe("recipeCost", () => {
  const FLOUR: CostIngredient = { ingredientId: 1, amount: 200, unit: "g", optional: false, defaultUnit: "g", density: 0.53, gramsPerEach: null };
  const SUGAR: CostIngredient = { ingredientId: 2, amount: 50, unit: "g", optional: false, defaultUnit: "g", density: null, gramsPerEach: null };

  it("sums amount × price-per-unit and derives per-serving", () => {
    const c = recipeCost([FLOUR, SUGAR], new Map([[1, 0.005], [2, 0.004]]), 4);
    // flour 200g*0.005 = 1.0 ; sugar 50g*0.004 = 0.2 → total 1.2
    expect(c.total).toBeCloseTo(1.2, 6);
    expect(c.perServing).toBeCloseTo(0.3, 6);
    expect(c.knownCount).toBe(2);
    expect(c.unknownIngredientIds).toEqual([]);
  });

  it("converts the recipe unit to the default unit via density", () => {
    const cupFlour: CostIngredient = { ingredientId: 1, amount: 1, unit: "cup", optional: false, defaultUnit: "g", density: 0.53, gramsPerEach: null };
    const c = recipeCost([cupFlour], new Map([[1, 0.01]]), 1);
    // 1 cup flour ≈ 125.39 g × $0.01/g ≈ $1.25
    expect(c.total).toBeCloseTo(1.2539, 3);
  });

  it("flags ingredients with no price and excludes them from the total", () => {
    const c = recipeCost([FLOUR, SUGAR], new Map([[1, 0.005], [2, null]]), 1);
    expect(c.total).toBeCloseTo(1.0, 6);
    expect(c.unknownIngredientIds).toEqual([2]);
    expect(c.lines.find((l) => l.ingredientId === 2)?.reason).toBe("no-price");
    expect(c.knownCount).toBe(1);
    expect(c.countedCount).toBe(2);
  });

  it("flags unconvertible units", () => {
    const cupNoDensity: CostIngredient = { ingredientId: 2, amount: 1, unit: "cup", optional: false, defaultUnit: "g", density: null, gramsPerEach: null };
    const c = recipeCost([cupNoDensity], new Map([[2, 0.01]]), 1);
    expect(c.total).toBe(0);
    expect(c.lines[0].reason).toBe("unconvertible");
    expect(c.unknownIngredientIds).toEqual([2]);
  });

  it("excludes optional ingredients entirely", () => {
    const optional: CostIngredient = { ...SUGAR, optional: true };
    const c = recipeCost([FLOUR, optional], new Map([[1, 0.005], [2, 0.004]]), 1);
    expect(c.total).toBeCloseTo(1.0, 6);
    expect(c.countedCount).toBe(1);
  });

  it("combines a duplicated ingredient (e.g. butter in two sections) into one line", () => {
    const butterCrust: CostIngredient = { ingredientId: 3, amount: 125, unit: "g", optional: false, defaultUnit: "g", density: 0.96, gramsPerEach: null };
    const butterFilling: CostIngredient = { ...butterCrust, amount: 100 };
    const c = recipeCost([butterCrust, butterFilling], new Map([[3, 0.01]]), 1);
    // 225 g × $0.01/g = $2.25, and butter appears once.
    expect(c.total).toBeCloseTo(2.25, 6);
    expect(c.countedCount).toBe(1);
    expect(c.lines).toHaveLength(1);
    expect(c.lines[0].ingredientId).toBe(3);
  });

  it("bridges count→mass via gramsPerEach for cost calculation", () => {
    // recipe: 2 tomatoes, defaultUnit lb, gramsPerEach 150 → 2×150=300g → ~0.661 lb
    // price: $1.99/lb → cost ≈ 0.661 × 1.99 ≈ $1.316
    const tomato: CostIngredient = { ingredientId: 4, amount: 2, unit: "each", optional: false, defaultUnit: "lb", density: null, gramsPerEach: 150 };
    const pricePerLb = 1.99;
    const c = recipeCost([tomato], new Map([[4, pricePerLb]]), 1);
    // 2 × 150 g = 300 g → convert to lb: 300 / 453.59237 ≈ 0.6614 lb
    expect(c.total).toBeCloseTo((300 / 453.59237) * pricePerLb, 3);
    expect(c.knownCount).toBe(1);
  });
});

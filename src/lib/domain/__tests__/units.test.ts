import { describe, expect, it } from "vitest";
import {
  UNITS,
  DEFAULT_DENSITIES,
  getUnit,
  convert,
  toSystem,
  UnconvertibleError,
} from "@/lib/domain/units";

// Phase 0 smoke tests: confirm the unit table + densities are wired correctly
// and the test harness runs. Conversion/scaling/formatting tests land in Phase 2.
describe("UNITS table", () => {
  it("uses the documented base factors (Appendix A)", () => {
    expect(UNITS.ml.toBase).toBe(1);
    expect(UNITS.g.toBase).toBe(1);
    expect(UNITS.tbsp.toBase).toBeCloseTo(14.78676, 5);
    expect(UNITS.cup.toBase).toBeCloseTo(236.5882, 4);
    expect(UNITS.lb.toBase).toBeCloseTo(453.59237, 5);
  });

  it("keeps mass oz and volume fl_oz distinct (§3.3 edge case)", () => {
    expect(UNITS.oz.category).toBe("mass");
    expect(UNITS.fl_oz.category).toBe("volume");
  });

  it("flags pinch as approximate (never scaled)", () => {
    expect(UNITS.pinch.approximate).toBe(true);
  });

  it("resolves units by id and returns undefined for unknowns", () => {
    expect(getUnit("kg")?.label).toBe("kg");
    expect(getUnit("nope")).toBeUndefined();
    expect(getUnit(null)).toBeUndefined();
  });
});

describe("DEFAULT_DENSITIES", () => {
  it("includes seeded densities for volume<->weight bridging (Appendix B)", () => {
    expect(DEFAULT_DENSITIES["All-purpose flour"]).toBeCloseTo(0.53);
    expect(DEFAULT_DENSITIES.Water).toBe(1.0);
  });
});

describe("convert (§5.2)", () => {
  it("converts within a category exactly", () => {
    expect(convert(1, "cup", "ml")).toBeCloseTo(236.5882, 4);
    expect(convert(1, "l", "ml")).toBe(1000);
    expect(convert(16, "oz", "lb")).toBeCloseTo(1, 6);
    expect(convert(1, "kg", "g")).toBe(1000);
  });

  it("round-trips", () => {
    expect(convert(convert(2, "cup", "ml"), "ml", "cup")).toBeCloseTo(2, 6);
  });

  it("keeps mass oz and volume fl_oz distinct", () => {
    expect(convert(1, "oz", "g")).toBeCloseTo(28.34952, 5);
    expect(convert(1, "fl_oz", "ml")).toBeCloseTo(29.57353, 5);
    expect(() => convert(1, "oz", "ml")).toThrow(UnconvertibleError);
  });

  it("bridges volume<->mass with density", () => {
    // 1 cup flour (236.5882 ml) * 0.53 g/ml ≈ 125.4 g
    expect(convert(1, "cup", "g", 0.53)).toBeCloseTo(125.39, 1);
    // inverse
    expect(convert(125.39, "g", "cup", 0.53)).toBeCloseTo(1, 2);
  });

  it("throws UnconvertibleError across categories without density, or for unknown units", () => {
    expect(() => convert(1, "cup", "g")).toThrow(UnconvertibleError);
    expect(() => convert(1, "nope", "g")).toThrow(UnconvertibleError);
  });

  it("bridges count<->mass with gramsPerEach", () => {
    // 2 tomatoes × 150 g/each = 300 g
    expect(convert(2, "each", "g", undefined, 150)).toBeCloseTo(300, 6);
    // inverse: 300 g / 150 g/each = 2 each
    expect(convert(300, "g", "each", undefined, 150)).toBeCloseTo(2, 6);
    // to imperial mass: 2 × 150 g / 28.34952 g/oz ≈ 10.58 oz
    expect(convert(2, "each", "oz", undefined, 150)).toBeCloseTo(300 / 28.34952, 3);
  });

  it("bridges count<->volume with both gramsPerEach and density", () => {
    // 2 tomatoes × 150 g/each, density 0.8 g/ml → in cups: 300/0.8/236.5882 ≈ 1.583 cups
    const gpe = 150;
    const density = 0.8;
    expect(convert(2, "each", "cup", density, gpe)).toBeCloseTo(300 / density / 236.5882, 3);
    // inverse
    expect(convert(300 / density / 236.5882, "cup", "each", density, gpe)).toBeCloseTo(2, 3);
  });

  it("throws when missing gramsPerEach for count<->mass conversion", () => {
    expect(() => convert(2, "each", "g")).toThrow(UnconvertibleError);
    expect(() => convert(2, "each", "cup", 0.8)).toThrow(UnconvertibleError); // gpe missing
  });
});

describe("toSystem", () => {
  it("converts imperial volume to metric", () => {
    const r = toSystem({ amount: 1, unit: "cup" }, "metric");
    expect(r.unit).toBe("ml");
    expect(r.amount).toBeCloseTo(236.5882, 3);
  });

  it("promotes large metric volumes to litres when crossing systems", () => {
    const r = toSystem({ amount: 5, unit: "cup" }, "metric"); // ~1182 ml
    expect(r.unit).toBe("l");
    expect(r.amount).toBeCloseTo(1.1829, 3);
  });

  it("leaves amounts already in the target system unchanged", () => {
    const r = toSystem({ amount: 2, unit: "tbsp" }, "imperial");
    expect(r).toEqual({ amount: 2, amountMax: null, unit: "tbsp" });
  });

  it("converts imperial mass to metric and large metric mass to imperial lb", () => {
    expect(toSystem({ amount: 8, unit: "oz" }, "metric").unit).toBe("g");
    const lb = toSystem({ amount: 500, unit: "g" }, "imperial");
    expect(lb.unit).toBe("lb");
    expect(lb.amount).toBeCloseTo(1.1023, 3);
  });

  it("never converts counts or approximate units", () => {
    expect(toSystem({ amount: 2, unit: "each" }, "metric").unit).toBe("each");
    expect(toSystem({ amount: 1, unit: "pinch" }, "metric").unit).toBe("pinch");
  });

  it("carries range maxima through conversion", () => {
    const r = toSystem({ amount: 1, amountMax: 2, unit: "cup" }, "metric");
    expect(r.amountMax).toBeCloseTo(473.18, 1);
  });

  it("promotes large metric volumes to qt then gal when converting to imperial", () => {
    // ~1892.7 ml → 2 qt
    const qt = toSystem({ amount: 1892.706, unit: "ml" }, "imperial");
    expect(qt.unit).toBe("qt");
    expect(qt.amount).toBeCloseTo(2, 3);

    // ~7570.8 ml → 2 gal
    const gal = toSystem({ amount: 7570.82, unit: "ml" }, "imperial");
    expect(gal.unit).toBe("gal");
    expect(gal.amount).toBeCloseTo(2, 3);
  });
});

describe("qt and gal conversions", () => {
  it("converts quart to cups and ml", () => {
    expect(convert(1, "qt", "cup")).toBeCloseTo(4, 4);
    expect(convert(1, "qt", "ml")).toBeCloseTo(946.353, 3);
  });

  it("converts gallon to quarts, cups, and ml", () => {
    expect(convert(1, "gal", "qt")).toBeCloseTo(4, 4);
    expect(convert(1, "gal", "cup")).toBeCloseTo(16, 4);
    expect(convert(1, "gal", "ml")).toBeCloseTo(3785.41, 2);
  });

  it("round-trips qt and gal", () => {
    expect(convert(convert(3, "qt", "ml"), "ml", "qt")).toBeCloseTo(3, 5);
    expect(convert(convert(1, "gal", "l"), "l", "gal")).toBeCloseTo(1, 5);
  });

  it("has correct base factors", () => {
    expect(UNITS.qt.toBase).toBeCloseTo(946.353, 3);
    expect(UNITS.gal.toBase).toBeCloseTo(3785.41, 2);
  });
});

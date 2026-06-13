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
});

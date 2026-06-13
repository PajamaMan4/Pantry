import { describe, expect, it } from "vitest";
import { UNITS, DEFAULT_DENSITIES, getUnit } from "@/lib/domain/units";

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

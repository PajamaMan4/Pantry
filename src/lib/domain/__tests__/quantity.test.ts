import { describe, expect, it } from "vitest";
import { formatQuantity, toFriendlyFraction, toMetricNumber } from "@/lib/domain/quantity";

describe("toFriendlyFraction", () => {
  it("renders common fractions", () => {
    expect(toFriendlyFraction(0.5)).toBe("½");
    expect(toFriendlyFraction(0.25)).toBe("¼");
    expect(toFriendlyFraction(1.75)).toBe("1¾");
    expect(toFriendlyFraction(0.333)).toBe("⅓");
    expect(toFriendlyFraction(2)).toBe("2");
  });

  it("rounds up when very close to the next whole", () => {
    expect(toFriendlyFraction(1.97)).toBe("2");
  });

  it("exact mode skips fractions", () => {
    expect(toFriendlyFraction(1.75, "exact")).toBe("1.75");
  });
});

describe("toMetricNumber", () => {
  it("rounds g/ml to whole in cooking mode and keeps 2dp for L/kg", () => {
    expect(toMetricNumber(236.5882, "ml")).toBe("237");
    expect(toMetricNumber(1.4999, "l")).toBe("1.5");
  });
});

describe("formatQuantity", () => {
  it("formats imperial with fractions + unit label", () => {
    expect(formatQuantity({ amount: 1.75, unit: "cup" }, "imperial")).toBe("1¾ cup");
    expect(formatQuantity({ amount: 0.5, unit: "tsp" }, "imperial")).toBe("½ tsp");
  });

  it("formats metric numbers + unit label", () => {
    expect(formatQuantity({ amount: 236.5882, unit: "ml" }, "metric")).toBe("237 ml");
    expect(formatQuantity({ amount: 1.5, unit: "l" }, "metric")).toBe("1.5 L");
  });

  it("formats ranges (both ends)", () => {
    expect(formatQuantity({ amount: 2, amountMax: 3, unit: null }, "imperial")).toBe("2–3");
  });

  it("returns the raw descriptor when amount is null", () => {
    expect(formatQuantity({ amount: null, unit: null, raw: "to taste" }, "imperial")).toBe("to taste");
  });
});

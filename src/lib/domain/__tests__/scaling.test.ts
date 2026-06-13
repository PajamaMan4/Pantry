import { describe, expect, it } from "vitest";
import {
  scaleFactor,
  scaleIngredientAmount,
  displayQuantity,
  renderStep,
  maybeFallbackScale,
} from "@/lib/domain/scaling";

describe("scaleFactor / scaleIngredientAmount", () => {
  it("computes the factor and guards divide-by-zero", () => {
    expect(scaleFactor(4, 8)).toBe(2);
    expect(scaleFactor(0, 5)).toBe(1);
  });

  it("scales numbers and ranges but not non-numeric/approximate", () => {
    expect(scaleIngredientAmount(2, null, 2)).toEqual({ amount: 4, amountMax: null });
    expect(scaleIngredientAmount(2, 3, 2)).toEqual({ amount: 4, amountMax: 6 });
    expect(scaleIngredientAmount(null, null, 2)).toEqual({ amount: null, amountMax: null });
    expect(scaleIngredientAmount(1, null, 3, true)).toEqual({ amount: 1, amountMax: null });
  });
});

describe("displayQuantity", () => {
  it("scales in the original system", () => {
    expect(displayQuantity({ amount: 2, unit: "cup" }, { factor: 2, system: "original" })).toBe("4 cup");
  });

  it("scales and converts to metric", () => {
    expect(displayQuantity({ amount: 2, unit: "cup" }, { factor: 2, system: "metric" })).toBe("946 ml");
  });

  it("keeps approximate units unscaled", () => {
    expect(displayQuantity({ amount: 1, unit: "pinch" }, { factor: 3, system: "original" })).toBe("1 pinch");
  });

  it("passes through 'to taste'", () => {
    expect(
      displayQuantity({ amount: null, unit: null, raw: "to taste" }, { factor: 2, system: "metric" }),
    ).toBe("to taste");
  });
});

describe("renderStep", () => {
  const step = {
    text: "Add {q1} butter and bake at 350°F for 20 minutes.",
    quantities: { q1: { ingredientId: null, amount: 2, unit: "tbsp" } },
  };

  it("substitutes + scales placeholders while leaving temps/times untouched", () => {
    expect(renderStep(step, { factor: 2, system: "original" })).toBe(
      "Add 4 tbsp butter and bake at 350°F for 20 minutes.",
    );
  });

  it("converts placeholder units to metric without touching prose", () => {
    expect(renderStep(step, { factor: 1, system: "metric" })).toBe(
      "Add 30 ml butter and bake at 350°F for 20 minutes.",
    );
  });

  it("leaves an unmatched placeholder in place", () => {
    expect(renderStep({ text: "Add {q9}.", quantities: { q1: { ingredientId: null, amount: 1, unit: "g" } } }, { factor: 2, system: "original" })).toBe("Add {q9}.");
  });

  it("does not scale unlinked steps unless fallback is enabled", () => {
    const plain = { text: "Add 2 tbsp butter." };
    expect(renderStep(plain, { factor: 2, system: "original" })).toBe("Add 2 tbsp butter.");
    expect(renderStep(plain, { factor: 2, system: "original", fallback: true })).toBe("Add 4 tbsp butter.");
  });
});

describe("maybeFallbackScale (conservative)", () => {
  it("scales measurement spans only", () => {
    expect(maybeFallbackScale("Add 2 tbsp butter.", { factor: 2, system: "original" })).toBe("Add 4 tbsp butter.");
    expect(maybeFallbackScale("Use 1/2 cup sugar.", { factor: 2, system: "original" })).toBe("Use 1 cup sugar.");
    expect(maybeFallbackScale("Add 2-3 cups flour.", { factor: 2, system: "original" })).toBe("Add 4–6 cups flour.");
  });

  it("never touches temperatures or times", () => {
    const t = "Bake at 350°F for 20 minutes, then rest 5 min.";
    expect(maybeFallbackScale(t, { factor: 2, system: "original" })).toBe(t);
  });

  it("is a no-op at factor 1", () => {
    expect(maybeFallbackScale("Add 2 tbsp butter.", { factor: 1, system: "original" })).toBe("Add 2 tbsp butter.");
  });
});

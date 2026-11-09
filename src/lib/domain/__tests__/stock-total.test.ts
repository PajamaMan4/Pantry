import { describe, expect, it } from "vitest";
import { aggregateStock } from "@/lib/domain/stock-total";

const item = (quantity: number, unit: string | null) => ({ quantity, unit });

describe("aggregateStock — as written", () => {
  it("adds amounts entered in the same unit without converting", () => {
    expect(aggregateStock([item(1, "cup"), item(2, "cup")], "original", "cooking")).toBe("3 cup");
  });

  it("combines mixed units into the largest one entered", () => {
    expect(aggregateStock([item(1, "lb"), item(16, "oz")], "original", "cooking")).toBe("2 lb");
    expect(aggregateStock([item(500, "g"), item(1, "kg")], "original", "cooking")).toBe("1.5 kg");
  });

  it("combines across measurement systems", () => {
    expect(aggregateStock([item(1, "cup"), item(2, "tbsp")], "original", "cooking")).toBe("1⅛ cup");
  });

  it("keeps mass and volume as separate totals", () => {
    expect(aggregateStock([item(1, "lb"), item(2, "cup")], "original", "cooking")).toBe("1 lb + 2 cup");
  });

  it("keeps approximate and unitless amounts separate", () => {
    expect(aggregateStock([item(1, "cup"), item(2, "pinch"), item(3, null)], "original", "cooking")).toBe(
      "1 cup + 2 pinch + 3",
    );
  });
});

describe("aggregateStock — converted systems", () => {
  it("returns null with no items", () => {
    expect(aggregateStock([], "imperial", "cooking")).toBeNull();
  });

  it("still converts the combined total to the chosen system", () => {
    expect(aggregateStock([item(1, "lb"), item(16, "oz")], "metric", "cooking")).toBe("907 g");
  });
});

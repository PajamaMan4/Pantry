import { describe, expect, it } from "vitest";
import { parseProductQuantity } from "../product-quantity";

describe("parseProductQuantity", () => {
  it("prefers the numeric product_quantity/product_quantity_unit pair", () => {
    expect(parseProductQuantity({ productQuantity: 330, productQuantityUnit: "ml" })).toEqual({
      amount: 330,
      unit: "ml",
    });
  });

  it("coerces a string-typed product_quantity (older API responses)", () => {
    expect(parseProductQuantity({ productQuantity: "500", productQuantityUnit: "g" })).toEqual({
      amount: 500,
      unit: "g",
    });
  });

  it("parses a plain quantity string with a space", () => {
    expect(parseProductQuantity({ quantity: "500 g" })).toEqual({ amount: 500, unit: "g" });
  });

  it("parses a quantity string with no space before the unit", () => {
    expect(parseProductQuantity({ quantity: "355g" })).toEqual({ amount: 355, unit: "g" });
  });

  it("parses liters", () => {
    expect(parseProductQuantity({ quantity: "1 L" })).toEqual({ amount: 1, unit: "l" });
  });

  it("parses a European decimal comma", () => {
    expect(parseProductQuantity({ quantity: "1,5 L" })).toEqual({ amount: 1.5, unit: "l" });
  });

  it("parses fluid ounces", () => {
    expect(parseProductQuantity({ quantity: "16.9 fl oz" })).toEqual({ amount: 16.9, unit: "fl_oz" });
  });

  it("parses a multipack string", () => {
    expect(parseProductQuantity({ quantity: "12 x 330 ml" })).toEqual({ amount: 3960, unit: "ml" });
  });

  it("scales centiliters to ml", () => {
    expect(parseProductQuantity({ quantity: "33 cl" })).toEqual({ amount: 330, unit: "ml" });
  });

  it("scales milligrams to g", () => {
    expect(parseProductQuantity({ quantity: "250 mg" })).toEqual({ amount: 0.25, unit: "g" });
  });

  it("returns null for an empty string", () => {
    expect(parseProductQuantity({ quantity: "" })).toBeNull();
  });

  it("returns null for an empty input", () => {
    expect(parseProductQuantity({})).toBeNull();
  });

  it("returns null for an unrecognized unit word", () => {
    expect(parseProductQuantity({ quantity: "1 sachet" })).toBeNull();
  });

  it("returns null for a zero amount", () => {
    expect(parseProductQuantity({ quantity: "0 g" })).toBeNull();
  });

  it("returns null for a negative amount", () => {
    expect(parseProductQuantity({ quantity: "-5 g" })).toBeNull();
  });

  it("falls through to the quantity string when the numeric unit is unrecognized", () => {
    expect(
      parseProductQuantity({ productQuantity: 500, productQuantityUnit: "weirdo", quantity: "500 g" }),
    ).toEqual({ amount: 500, unit: "g" });
  });
});

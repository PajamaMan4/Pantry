import { describe, expect, it } from "vitest";
import { summarizeMenuIngredients, type MenuIngredientRow } from "@/lib/domain/menu";
import type { InventoryStock } from "@/lib/domain/recommend";

const now = new Date("2026-06-13T12:00:00");

function row(ingredientId: number, name: string, p: Partial<MenuIngredientRow> = {}): MenuIngredientRow {
  return { ingredientId, name, amount: 100, unit: "g", optional: false, isStaple: false, density: null, gramsPerEach: null, ...p };
}

describe("summarizeMenuIngredients", () => {
  it("returns no lines for an empty menu", () => {
    expect(summarizeMenuIngredients([], [], now).lines).toEqual([]);
  });

  it("sums the same ingredient across recipes into one line", () => {
    const rows = [
      row(1, "Flour", { amount: 200, unit: "g" }), // recipe A
      row(1, "Flour", { amount: 150, unit: "g" }), // recipe B
    ];
    const inv: InventoryStock[] = [{ ingredientId: 1, quantity: 1000, unit: "g", expiryMs: null }];
    const { lines } = summarizeMenuIngredients(rows, inv, now);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ ingredientId: 1, name: "Flour", amount: 350, unit: "g", inStock: true });
  });

  it("flags inStock=false when summed demand exceeds inventory", () => {
    const rows = [
      row(1, "Flour", { amount: 600, unit: "g" }),
      row(1, "Flour", { amount: 600, unit: "g" }), // 1200g needed
    ];
    const inv: InventoryStock[] = [{ ingredientId: 1, quantity: 1000, unit: "g", expiryMs: null }];
    const { lines } = summarizeMenuIngredients(rows, inv, now);
    expect(lines[0]).toMatchObject({ amount: 1200, inStock: false });
  });

  it("sums across units using density (ml + g)", () => {
    // 100 ml milk @ 1.03 g/ml ≈ 103 g, plus 100 g => combined in the rep unit (ml).
    const rows = [
      row(2, "Milk", { amount: 100, unit: "ml", density: 1.03 }),
      row(2, "Milk", { amount: 103, unit: "g", density: 1.03 }),
    ];
    const inv: InventoryStock[] = [{ ingredientId: 2, quantity: 1, unit: "l", expiryMs: null }];
    const { lines } = summarizeMenuIngredients(rows, inv, now);
    expect(lines[0].unit).toBe("ml");
    expect(lines[0].amount).toBeCloseTo(200, 1); // 100ml + (103g / 1.03) = 200ml
    expect(lines[0].inStock).toBe(true); // 200ml ≤ 1000ml on hand
  });

  it("treats staples as in stock even with no inventory", () => {
    const rows = [row(9, "Salt", { isStaple: true })];
    const { lines } = summarizeMenuIngredients(rows, [], now);
    expect(lines[0]).toMatchObject({ ingredientId: 9, inStock: true });
  });

  it("marks an ingredient missing from inventory as not in stock", () => {
    const rows = [row(3, "Saffron", { amount: 1, unit: "g" })];
    const { lines } = summarizeMenuIngredients(rows, [], now);
    expect(lines[0].inStock).toBe(false);
  });

  it("sorts lines alphabetically by name", () => {
    const rows = [
      row(1, "Zucchini", { amount: 1, unit: "each", gramsPerEach: 200 }),
      row(2, "Apple", { amount: 1, unit: "each", gramsPerEach: 180 }),
    ];
    const { lines } = summarizeMenuIngredients(rows, [], now);
    expect(lines.map((l) => l.name)).toEqual(["Apple", "Zucchini"]);
  });
});

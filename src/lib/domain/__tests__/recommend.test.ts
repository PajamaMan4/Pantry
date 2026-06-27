import { describe, expect, it } from "vitest";
import {
  recommendRecipes,
  type RecommendIngredient,
  type RecommendRecipe,
  type InventoryStock,
} from "@/lib/domain/recommend";

const now = new Date("2026-06-13T12:00:00");

function ing(ingredientId: number, p: Partial<RecommendIngredient> = {}): RecommendIngredient {
  return { ingredientId, amount: 100, unit: "g", optional: false, isStaple: false, density: null, gramsPerEach: null, ...p };
}
function recipe(id: number, name: string, ingredients: RecommendIngredient[]): RecommendRecipe {
  return { id, name, ingredients };
}
const noCost = new Map<number, number | null>();

describe("recommendRecipes — coverage", () => {
  it("counts only non-optional, non-staple ingredients and flags missing", () => {
    const r = recipe(1, "Soup", [
      ing(1, { amount: 200, unit: "g" }), // flour
      ing(2, { amount: 50, unit: "g" }), // sugar
      ing(3, { amount: 100, unit: "ml" }), // milk (missing)
      ing(4, { isStaple: true }), // salt (excluded)
      ing(5, { optional: true }), // optional (excluded)
    ]);
    const inv: InventoryStock[] = [
      { ingredientId: 1, quantity: 500, unit: "g", expiryMs: null },
      { ingredientId: 2, quantity: 100, unit: "g", expiryMs: null },
    ];
    const [res] = recommendRecipes([r], inv, "available", noCost, now);
    expect(res.requiredCount).toBe(3);
    expect(res.missing).toEqual([3]);
    expect(res.coverage).toBeCloseTo(2 / 3, 6);
    expect(res.almost).toBe(true);
    expect(res.makeable).toBe(false);
  });

  it("makeable when everything required is in stock", () => {
    const r = recipe(1, "A", [ing(1, { amount: 100, unit: "g" })]);
    const [res] = recommendRecipes([r], [{ ingredientId: 1, quantity: 200, unit: "g", expiryMs: null }], "available", noCost, now);
    expect(res.makeable).toBe(true);
    expect(res.coverage).toBe(1);
    expect(res.missing).toEqual([]);
  });

  it("not enough quantity → missing", () => {
    const r = recipe(1, "A", [ing(1, { amount: 600, unit: "g" })]);
    const [res] = recommendRecipes([r], [{ ingredientId: 1, quantity: 500, unit: "g", expiryMs: null }], "available", noCost, now);
    expect(res.makeable).toBe(false);
    expect(res.missing).toEqual([1]);
  });

  it("recipe with no required ingredients is trivially makeable", () => {
    const r = recipe(1, "Water", [ing(1, { isStaple: true }), ing(2, { optional: true })]);
    const [res] = recommendRecipes([r], [], "available", noCost, now);
    expect(res.makeable).toBe(true);
    expect(res.coverage).toBe(1);
  });
});

describe("recommendRecipes — unit reconciliation", () => {
  it("bridges volume↔mass with density", () => {
    const r = recipe(1, "A", [ing(1, { amount: 1, unit: "cup", density: 0.53 })]); // ≈125 g
    const [res] = recommendRecipes([r], [{ ingredientId: 1, quantity: 500, unit: "g", expiryMs: null }], "available", noCost, now);
    expect(res.makeable).toBe(true);
  });

  it("unconvertible (no density) → unknown availability, flagged + missing", () => {
    const r = recipe(1, "A", [ing(1, { amount: 1, unit: "cup", density: null })]);
    const [res] = recommendRecipes([r], [{ ingredientId: 1, quantity: 500, unit: "g", expiryMs: null }], "available", noCost, now);
    expect(res.unknownUnits).toBe(1);
    expect(res.missing).toEqual([1]);
  });

  it("non-numeric required amount → assumed available", () => {
    const r = recipe(1, "A", [ing(1, { amount: null, unit: null })]);
    const [res] = recommendRecipes([r], [{ ingredientId: 1, quantity: 1, unit: "g", expiryMs: null }], "available", noCost, now);
    expect(res.makeable).toBe(true);
  });

  it("bridges count↔mass with gramsPerEach (recipe each, stock lb)", () => {
    // recipe: 2 tomatoes × 150 g/each = 300 g; stock: 1 lb ≈ 453.59 g → have
    const r = recipe(1, "A", [ing(1, { amount: 2, unit: "each", gramsPerEach: 150 })]);
    const [res] = recommendRecipes([r], [{ ingredientId: 1, quantity: 1, unit: "lb", expiryMs: null }], "available", noCost, now);
    expect(res.makeable).toBe(true);
  });

  it("bridges count↔mass with gramsPerEach — not enough stock", () => {
    // recipe: 5 tomatoes × 150 g/each = 750 g; stock: 1 lb ≈ 453.59 g → missing
    const r = recipe(1, "A", [ing(1, { amount: 5, unit: "each", gramsPerEach: 150 })]);
    const [res] = recommendRecipes([r], [{ ingredientId: 1, quantity: 1, unit: "lb", expiryMs: null }], "available", noCost, now);
    expect(res.makeable).toBe(false);
    expect(res.missing).toContain(1);
  });

  it("count↔mass without gramsPerEach → unknown", () => {
    const r = recipe(1, "A", [ing(1, { amount: 2, unit: "each", gramsPerEach: null })]);
    const [res] = recommendRecipes([r], [{ ingredientId: 1, quantity: 500, unit: "g", expiryMs: null }], "available", noCost, now);
    expect(res.unknownUnits).toBe(1);
  });

  it("same ingredient appearing in two lines with incompatible units is treated as one requirement", () => {
    // Green Onions scenario: primary line is 6 each, secondary line is 1 tbsp (garnish).
    // No density/gramsPerEach, so count↔volume can't convert. The secondary line's
    // incompatibility must NOT drag the ingredient into missing/unknownUnits.
    // Stock: 10 each → fully satisfies the 6 each primary requirement.
    const r = recipe(1, "Dish", [
      ing(1, { amount: 6, unit: "each", density: null, gramsPerEach: null }),
      ing(1, { amount: 1, unit: "tbsp", density: null, gramsPerEach: null }),
    ]);
    const [res] = recommendRecipes([r], [{ ingredientId: 1, quantity: 10, unit: "each", expiryMs: null }], "available", noCost, now);
    expect(res.makeable).toBe(true);
    expect(res.missing).not.toContain(1);
    expect(res.unknownUnits).toBe(0);
    expect(res.requiredCount).toBe(1); // counted once, not twice
  });
});

describe("recommendRecipes — sorting", () => {
  const full = recipe(1, "Full", [ing(1, { amount: 100, unit: "g" })]);
  const half = recipe(2, "Half", [ing(2, { amount: 100, unit: "g" }), ing(3, { amount: 100, unit: "g" })]);
  const inv: InventoryStock[] = [
    { ingredientId: 1, quantity: 200, unit: "g", expiryMs: null },
    { ingredientId: 2, quantity: 200, unit: "g", expiryMs: null },
  ];

  it("available → higher coverage first", () => {
    const out = recommendRecipes([half, full], inv, "available", noCost, now);
    expect(out.map((r) => r.recipe.id)).toEqual([1, 2]);
  });

  it("cost → makeable first, then lowest cost", () => {
    const cost = new Map<number, number | null>([
      [1, 5],
      [2, 1],
    ]);
    // both makeable? full makeable; half not (missing id 3). makeable ranks first.
    const out = recommendRecipes([half, full], inv, "cost", cost, now);
    expect(out[0].recipe.id).toBe(1); // makeable first despite higher cost
  });

  it("expiring → makeable recipes using soon-to-expire stock rank first", () => {
    const soon = new Date(now.getTime() + 1 * 86_400_000).getTime(); // tomorrow
    const a = recipe(1, "Aaa", [ing(1, { amount: 100, unit: "g" })]); // uses expiring stock
    const b = recipe(2, "Bbb", [ing(2, { amount: 100, unit: "g" })]); // uses non-expiring stock
    const inv2: InventoryStock[] = [
      { ingredientId: 1, quantity: 200, unit: "g", expiryMs: soon },
      { ingredientId: 2, quantity: 200, unit: "g", expiryMs: null },
    ];
    const out = recommendRecipes([b, a], inv2, "expiring", noCost, now);
    expect(out[0].recipe.id).toBe(1);
    expect(out[0].expiryUrgency).toBeGreaterThan(out[1].expiryUrgency);
  });
});

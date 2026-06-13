import { describe, expect, it } from "vitest";
import { recipeInputSchema } from "@/lib/validation/recipe";

// The recipe form submits strings; these tests pin the coercion bridge between
// the form payload and the typed data the DB layer expects.
describe("recipeInputSchema", () => {
  const base = {
    name: "Stew",
    description: "",
    prepTimeMin: "10",
    cookTimeMin: "",
    baseServings: "4",
    notes: "",
    isFavorite: false,
    tags: ["dinner"],
    ingredients: [
      { ingredientId: "", name: "Carrot", amount: "3", amountMax: "", unit: "each", raw: "", prep: "diced", optional: false },
      { ingredientId: "", name: "Salt", amount: "", amountMax: "", unit: "", raw: "to taste", prep: "", optional: true },
    ],
    steps: [{ id: "s1", text: "Cook it." }],
  };

  it("coerces stringy numbers and blanks to typed values", () => {
    const r = recipeInputSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.prepTimeMin).toBe(10);
    expect(r.data.cookTimeMin).toBeNull();
    expect(r.data.baseServings).toBe(4);
    expect(r.data.description).toBeNull();

    const carrot = r.data.ingredients[0];
    expect(carrot.ingredientId).toBeNull();
    expect(carrot.amount).toBe(3);
    expect(carrot.unit).toBe("each");

    const salt = r.data.ingredients[1];
    expect(salt.amount).toBeNull();
    expect(salt.unit).toBeNull();
    expect(salt.raw).toBe("to taste");
  });

  it("rejects a recipe with no name", () => {
    expect(recipeInputSchema.safeParse({ ...base, name: "   " }).success).toBe(false);
  });

  it("rejects an ingredient row with neither id nor name", () => {
    const bad = {
      ...base,
      ingredients: [{ ingredientId: "", name: "", amount: "1", amountMax: "", unit: "g", raw: "", prep: "", optional: false }],
    };
    expect(recipeInputSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects servings of 0", () => {
    expect(recipeInputSchema.safeParse({ ...base, baseServings: "0" }).success).toBe(false);
  });
});

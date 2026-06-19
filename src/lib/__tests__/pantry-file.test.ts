import { describe, expect, it } from "vitest";
import { pantryFileSchema } from "@/lib/pantry-file";
import { isSectioned } from "@/lib/domain/sections";

const base = {
  pantryVersion: 1,
  name: "Butter Tart",
  description: null,
  prepTimeMin: 20,
  cookTimeMin: 25,
  baseServings: 8,
  notes: null,
  isFavorite: false,
  tags: ["dessert"],
  steps: [{ id: "s1", text: "Bake it." }],
};

const ing = (name: string, amount: number | null) => ({
  name,
  amount,
  amountMax: null,
  unit: amount == null ? null : "g",
  raw: null,
  prep: null,
  optional: false,
});

describe("pantryFileSchema — flat / sectioned ingredients", () => {
  it("parses a flat ingredient list", () => {
    const r = pantryFileSchema.safeParse({ ...base, ingredients: [ing("flour", 250), ing("butter", 125)] });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(isSectioned(r.data.ingredients)).toBe(false);
  });

  it("parses a sectioned ingredient list", () => {
    const r = pantryFileSchema.safeParse({
      ...base,
      ingredients: [
        { title: "For the crust", ingredients: [ing("flour", 250), ing("butter", 125)] },
        { title: "For the filling", ingredients: [ing("butter", 100), ing("egg", 3)] },
      ],
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(isSectioned(r.data.ingredients)).toBe(true);
  });

  it("fails clearly on malformed JSON (section missing title)", () => {
    const r = pantryFileSchema.safeParse({
      ...base,
      ingredients: [{ ingredients: [ing("flour", 250)] }],
    });
    expect(r.success).toBe(false);
  });

  it("fails clearly when an ingredient amount has the wrong type", () => {
    const r = pantryFileSchema.safeParse({
      ...base,
      ingredients: [{ ...ing("flour", 250), amount: "a lot" }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects a wrong pantryVersion", () => {
    const r = pantryFileSchema.safeParse({ ...base, pantryVersion: 2, ingredients: [ing("flour", 250)] });
    expect(r.success).toBe(false);
  });
});

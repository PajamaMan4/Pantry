import { describe, expect, it } from "vitest";
import { ingredientEditSchema } from "@/lib/validation/ingredient";

// The ingredient edit form no longer renders a category field, but the column
// is kept for future use. `updateIngredient` spreads the parsed payload into
// the UPDATE, so an absent category must stay absent — parsing it to null
// would silently wipe stored categories on every save.
describe("ingredientEditSchema", () => {
  const base = { name: "Flour", defaultUnit: "g", density: "", gramsPerEach: "", isStaple: false };

  it("omits category entirely when the form doesn't submit one", () => {
    const r = ingredientEditSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.category).toBeUndefined();
    expect(Object.keys(r.data)).not.toContain("category");
  });

  it("still accepts a category when one is supplied", () => {
    const r = ingredientEditSchema.safeParse({ ...base, category: " dairy " });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.category).toBe("dairy");
  });

  it("treats an explicitly blank category as a clear", () => {
    const r = ingredientEditSchema.safeParse({ ...base, category: "" });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.category).toBeNull();
  });
});

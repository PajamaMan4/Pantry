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

  it("defaults an absent or blank default location to null", () => {
    const r1 = ingredientEditSchema.safeParse(base);
    expect(r1.success).toBe(true);
    if (r1.success) {
      expect(r1.data.defaultLocationId).toBeNull();
      expect(r1.data.defaultLocationName).toBeNull();
    }

    const r2 = ingredientEditSchema.safeParse({ ...base, defaultLocationId: "", defaultLocationName: "" });
    expect(r2.success).toBe(true);
    if (r2.success) {
      expect(r2.data.defaultLocationId).toBeNull();
      expect(r2.data.defaultLocationName).toBeNull();
    }
  });

  it("parses a numeric default location id", () => {
    const r = ingredientEditSchema.safeParse({ ...base, defaultLocationId: 3 });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.defaultLocationId).toBe(3);
  });

  it("keeps a default location name when no id was picked", () => {
    const r = ingredientEditSchema.safeParse({ ...base, defaultLocationName: " Pantry " });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.defaultLocationId).toBeNull();
    expect(r.data.defaultLocationName).toBe("Pantry");
  });
});

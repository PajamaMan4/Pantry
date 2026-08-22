import { describe, expect, it } from "vitest";
import { settingsUpdateSchema } from "@/lib/validation/settings";

// The settings form submits FormData strings; these tests pin the coercion for
// the showRecipeImages toggle, which is a Base UI Switch rather than a native
// checkbox (see settings-form.tsx / actions.ts for why that matters).
describe("settingsUpdateSchema — showRecipeImages", () => {
  const base = {
    unitSystem: "imperial",
    priceMode: "average",
    averageWindowMonths: "6",
    currency: "USD",
    roundingMode: "cooking",
    recipesPerPage: "10",
    ingredientsPerPage: "25",
  };

  it("coerces the Switch's on-value to true", () => {
    const r = settingsUpdateSchema.safeParse({ ...base, showRecipeImages: "1" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.showRecipeImages).toBe(true);
  });

  it("coerces the Switch's off-value to false", () => {
    const r = settingsUpdateSchema.safeParse({ ...base, showRecipeImages: "0" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.showRecipeImages).toBe(false);
  });

  it("accepts a real boolean too", () => {
    const r = settingsUpdateSchema.safeParse({ ...base, showRecipeImages: true });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.showRecipeImages).toBe(true);
  });

  it("fails validation when the key is missing (formData.get returned null)", () => {
    const r = settingsUpdateSchema.safeParse({ ...base, showRecipeImages: null });
    expect(r.success).toBe(false);
  });
});

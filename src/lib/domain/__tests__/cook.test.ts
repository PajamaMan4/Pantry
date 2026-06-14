import { describe, expect, it } from "vitest";
import { planCook, type CookIngredientInput, type CookStockRow } from "@/lib/domain/cook";

function ing(p: Partial<CookIngredientInput> & { ingredientId: number }): CookIngredientInput {
  return {
    name: `ing-${p.ingredientId}`,
    amount: 100,
    unit: "g",
    optional: false,
    isStaple: false,
    density: null,
    ...p,
  };
}
function stock(rows: Record<number, CookStockRow[]>): Map<number, CookStockRow[]> {
  return new Map(Object.entries(rows).map(([k, v]) => [Number(k), v]));
}

describe("planCook — basic deduction", () => {
  it("deducts the scaled amount from a single matching row", () => {
    const plan = planCook(
      [ing({ ingredientId: 1, amount: 100, unit: "g" })],
      stock({ 1: [{ inventoryItemId: 10, quantity: 500, unit: "g", expiryMs: null }] }),
      2, // double
    );
    expect(plan.deductions).toEqual([{ inventoryItemId: 10, ingredientId: 1, amount: 200, unit: "g" }]);
    expect(plan.lines[0].status).toBe("ok");
    expect(plan.warnings).toEqual([]);
  });

  it("reconciles recipe unit vs stock unit via density (cup flour → grams)", () => {
    const plan = planCook(
      [ing({ ingredientId: 1, amount: 1, unit: "cup", density: 0.53 })],
      stock({ 1: [{ inventoryItemId: 10, quantity: 500, unit: "g", expiryMs: null }] }),
      1,
    );
    // 1 cup flour ≈ 125.39 g
    expect(plan.deductions[0].unit).toBe("g");
    expect(plan.deductions[0].amount).toBeCloseTo(125.39, 1);
    expect(plan.lines[0].status).toBe("ok");
  });
});

describe("planCook — FIFO by expiry across rows", () => {
  it("deducts soonest-expiry first, spilling to the next row", () => {
    const plan = planCook(
      [ing({ ingredientId: 1, amount: 400, unit: "g" })],
      stock({
        1: [
          { inventoryItemId: 20, quantity: 500, unit: "g", expiryMs: 5_000 }, // later
          { inventoryItemId: 10, quantity: 300, unit: "g", expiryMs: 1_000 }, // sooner
        ],
      }),
      1,
    );
    expect(plan.deductions).toEqual([
      { inventoryItemId: 10, ingredientId: 1, amount: 300, unit: "g" },
      { inventoryItemId: 20, ingredientId: 1, amount: 100, unit: "g" },
    ]);
    expect(plan.lines[0].status).toBe("ok");
  });
});

describe("planCook — edge cases", () => {
  it("required ingredient not in stock → missing + warning", () => {
    const plan = planCook([ing({ ingredientId: 1 })], stock({}), 1);
    expect(plan.lines[0].status).toBe("missing");
    expect(plan.warnings[0]).toMatch(/not in inventory/);
    expect(plan.deductions).toEqual([]);
  });

  it("staple not in stock → skipped silently", () => {
    const plan = planCook([ing({ ingredientId: 1, isStaple: true })], stock({}), 1);
    expect(plan.lines[0].status).toBe("skipped");
    expect(plan.warnings).toEqual([]);
  });

  it("optional not in stock → skipped silently", () => {
    const plan = planCook([ing({ ingredientId: 1, optional: true })], stock({}), 1);
    expect(plan.lines[0].status).toBe("skipped");
    expect(plan.warnings).toEqual([]);
  });

  it("unconvertible units (volume vs mass, no density) → skipped + flag, nothing deducted", () => {
    const plan = planCook(
      [ing({ ingredientId: 1, amount: 2, unit: "cup", density: null })],
      stock({ 1: [{ inventoryItemId: 10, quantity: 500, unit: "g", expiryMs: null }] }),
      1,
    );
    expect(plan.lines[0].status).toBe("unconvertible");
    expect(plan.deductions).toEqual([]);
    expect(plan.warnings[0]).toMatch(/can't convert/);
  });

  it("insufficient stock → clamps to available, partial + 'ran low'", () => {
    const plan = planCook(
      [ing({ ingredientId: 1, amount: 600, unit: "g" })],
      stock({ 1: [{ inventoryItemId: 10, quantity: 400, unit: "g", expiryMs: null }] }),
      1,
    );
    expect(plan.deductions[0].amount).toBe(400);
    expect(plan.lines[0].status).toBe("partial");
    expect(plan.warnings[0]).toMatch(/ran low/);
  });

  it("non-numeric amount ('to taste') → skipped, no deduction", () => {
    const plan = planCook(
      [ing({ ingredientId: 1, amount: null, unit: null })],
      stock({ 1: [{ inventoryItemId: 10, quantity: 5, unit: "g", expiryMs: null }] }),
      1,
    );
    expect(plan.lines[0].status).toBe("skipped");
    expect(plan.deductions).toEqual([]);
  });

  it("counts (each) reconcile with each, not with mass", () => {
    const ok = planCook(
      [ing({ ingredientId: 1, amount: 2, unit: "each" })],
      stock({ 1: [{ inventoryItemId: 10, quantity: 6, unit: "each", expiryMs: null }] }),
      1,
    );
    expect(ok.deductions[0].amount).toBe(2);
    expect(ok.lines[0].status).toBe("ok");
  });
});

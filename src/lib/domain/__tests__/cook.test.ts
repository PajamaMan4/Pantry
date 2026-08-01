import { describe, expect, it } from "vitest";
import {
  planCook,
  applySubstitutions,
  type CookIngredientInput,
  type CookStockRow,
  type ResolvedSubstitution,
} from "@/lib/domain/cook";

function ing(p: Partial<CookIngredientInput> & { ingredientId: number }): CookIngredientInput {
  return {
    name: `ing-${p.ingredientId}`,
    amount: 100,
    unit: "g",
    optional: false,
    isStaple: false,
    density: null,
    gramsPerEach: null,
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

describe("planCook — cross-unit full consumption is exact", () => {
  // A recipe that consumes the whole row but in a different unit must deduct the
  // exact stored quantity (not the slightly-short converted value), so the DB row
  // empties to exactly 0 and gets removed instead of lingering at ~1e-7 (which
  // renders as "0" in the inventory UI). Same-category conversions (oz↔lb, tsp↔cup)
  // lose ~1e-7 of relative precision, larger than the absolute 1e-9 epsilon.
  it("deducts the exact row quantity for 16 oz drawn from a 1 lb row", () => {
    const plan = planCook(
      [ing({ ingredientId: 1, amount: 16, unit: "oz" })],
      stock({ 1: [{ inventoryItemId: 10, quantity: 1, unit: "lb", expiryMs: null }] }),
      1,
    );
    expect(plan.deductions).toEqual([{ inventoryItemId: 10, ingredientId: 1, amount: 1, unit: "lb" }]);
    expect(plan.lines[0].status).toBe("ok");
    expect(plan.warnings).toEqual([]);
  });

  it("deducts the exact row quantity for 48 tsp drawn from a 1 cup row", () => {
    const plan = planCook(
      [ing({ ingredientId: 1, amount: 48, unit: "tsp" })],
      stock({ 1: [{ inventoryItemId: 10, quantity: 1, unit: "cup", expiryMs: null }] }),
      1,
    );
    expect(plan.deductions).toEqual([{ inventoryItemId: 10, ingredientId: 1, amount: 1, unit: "cup" }]);
    expect(plan.lines[0].status).toBe("ok");
    expect(plan.warnings).toEqual([]);
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

describe("planCook — duplicate ingredients across sections are summed", () => {
  // Butter appears in both the crust (125 g) and the filling (100 g): 225 g total.
  it("ok on both lines when stock covers the COMBINED total", () => {
    const plan = planCook(
      [
        ing({ ingredientId: 1, name: "butter", amount: 125, unit: "g" }),
        ing({ ingredientId: 1, name: "butter", amount: 100, unit: "g" }),
      ],
      stock({ 1: [{ inventoryItemId: 10, quantity: 250, unit: "g", expiryMs: null }] }),
      1,
    );
    expect(plan.lines.map((l) => l.status)).toEqual(["ok", "ok"]);
    // Deducted once for the whole ingredient, not once per line.
    expect(plan.deductions).toEqual([{ inventoryItemId: 10, ingredientId: 1, amount: 225, unit: "g" }]);
  });

  it("not-enough on both lines when stock covers each line but NOT the sum", () => {
    const plan = planCook(
      [
        ing({ ingredientId: 1, name: "butter", amount: 125, unit: "g" }),
        ing({ ingredientId: 1, name: "butter", amount: 100, unit: "g" }),
      ],
      stock({ 1: [{ inventoryItemId: 10, quantity: 200, unit: "g", expiryMs: null }] }), // 200 < 225
      1,
    );
    // Both lines reflect the combined shortfall, even though 200 ≥ either single line.
    expect(plan.lines.map((l) => l.status)).toEqual(["partial", "partial"]);
    expect(plan.deductions).toEqual([{ inventoryItemId: 10, ingredientId: 1, amount: 200, unit: "g" }]);
    expect(plan.warnings).toHaveLength(1); // one warning for the ingredient, not two
  });

  it("reconciles units before summing (1 cup + 100 g of flour vs stock in g)", () => {
    const plan = planCook(
      [
        ing({ ingredientId: 1, name: "flour", amount: 1, unit: "cup", density: 0.53 }), // ≈125.39 g
        ing({ ingredientId: 1, name: "flour", amount: 100, unit: "g", density: 0.53 }),
      ],
      stock({ 1: [{ inventoryItemId: 10, quantity: 1000, unit: "g", expiryMs: null }] }),
      1,
    );
    expect(plan.lines.map((l) => l.status)).toEqual(["ok", "ok"]);
    expect(plan.deductions).toHaveLength(1);
    expect(plan.deductions[0].amount).toBeCloseTo(225.39, 1);
  });

  it("a non-numeric occurrence is skipped on its own line; the numeric one still checks the total", () => {
    const plan = planCook(
      [
        ing({ ingredientId: 1, name: "salt", amount: 5, unit: "g" }),
        ing({ ingredientId: 1, name: "salt", amount: null, unit: null }), // "to taste"
      ],
      stock({ 1: [{ inventoryItemId: 10, quantity: 50, unit: "g", expiryMs: null }] }),
      1,
    );
    expect(plan.lines[0].status).toBe("ok");
    expect(plan.lines[1].status).toBe("skipped");
    expect(plan.deductions).toEqual([{ inventoryItemId: 10, ingredientId: 1, amount: 5, unit: "g" }]);
  });
});

describe("applySubstitutions — in-view swaps applied before planning", () => {
  const rowIng = (rowId: number, p: Partial<CookIngredientInput> & { ingredientId: number }) => ({
    rowId,
    ...ing(p),
  });

  it("replaces the matching row's ingredient/amount/unit and leaves others untouched", () => {
    const ingredients = [
      rowIng(100, { ingredientId: 1, name: "butter", amount: 50, unit: "g" }),
      rowIng(200, { ingredientId: 2, name: "sugar", amount: 30, unit: "g" }),
    ];
    const sub: ResolvedSubstitution = {
      rowId: 100,
      ingredient: ing({ ingredientId: 3, name: "margarine", amount: 40, unit: "g" }),
      stock: [{ inventoryItemId: 30, quantity: 200, unit: "g", expiryMs: null }],
    };
    const { ingredients: out } = applySubstitutions(ingredients, stock({}), [sub]);
    expect(out[0]).toMatchObject({ ingredientId: 3, name: "margarine", amount: 40, unit: "g" });
    expect(out[1]).toMatchObject({ ingredientId: 2, name: "sugar", amount: 30 });
  });

  it("merges the substitute's stock only when that ingredient isn't already stocked", () => {
    const ingredients = [rowIng(100, { ingredientId: 1, amount: 50, unit: "g" })];
    const existing = stock({ 3: [{ inventoryItemId: 99, quantity: 5, unit: "g", expiryMs: null }] });
    const sub: ResolvedSubstitution = {
      rowId: 100,
      ingredient: ing({ ingredientId: 3, amount: 40, unit: "g" }),
      stock: [{ inventoryItemId: 30, quantity: 200, unit: "g", expiryMs: null }],
    };
    const { stockByIngredient } = applySubstitutions(ingredients, existing, [sub]);
    // A real inventory entry for id 3 already exists → it wins, sub stock ignored.
    expect(stockByIngredient.get(3)).toEqual([{ inventoryItemId: 99, quantity: 5, unit: "g", expiryMs: null }]);

    const { stockByIngredient: added } = applySubstitutions(ingredients, stock({}), [sub]);
    // No prior stock for id 3 → the substitute's rows are merged in.
    expect(added.get(3)).toEqual([{ inventoryItemId: 30, quantity: 200, unit: "g", expiryMs: null }]);
  });

  it("ignores a substitution whose rowId matches no line", () => {
    const ingredients = [rowIng(100, { ingredientId: 1, amount: 50, unit: "g" })];
    const sub: ResolvedSubstitution = {
      rowId: 999, // stale
      ingredient: ing({ ingredientId: 3, amount: 40, unit: "g" }),
      stock: [],
    };
    const { ingredients: out } = applySubstitutions(ingredients, stock({}), [sub]);
    expect(out[0]).toMatchObject({ ingredientId: 1 });
  });

  it("empty substitution list is a no-op", () => {
    const ingredients = [rowIng(100, { ingredientId: 1, amount: 50, unit: "g" })];
    const s = stock({ 1: [{ inventoryItemId: 10, quantity: 100, unit: "g", expiryMs: null }] });
    const { ingredients: out, stockByIngredient } = applySubstitutions(ingredients, s, []);
    expect(out).toEqual(ingredients);
    expect(stockByIngredient.get(1)).toEqual(s.get(1));
  });

  it("plans a deduction against the substitute's stock end-to-end", () => {
    const ingredients = [rowIng(100, { ingredientId: 1, name: "butter", amount: 50, unit: "g" })];
    const sub: ResolvedSubstitution = {
      rowId: 100,
      ingredient: ing({ ingredientId: 3, name: "margarine", amount: 50, unit: "g" }),
      stock: [{ inventoryItemId: 30, quantity: 200, unit: "g", expiryMs: null }],
    };
    const { ingredients: eff, stockByIngredient } = applySubstitutions(ingredients, stock({}), [sub]);
    const plan = planCook(eff, stockByIngredient, 1);
    expect(plan.deductions).toEqual([{ inventoryItemId: 30, ingredientId: 3, amount: 50, unit: "g" }]);
    expect(plan.lines[0].status).toBe("ok");
  });
});

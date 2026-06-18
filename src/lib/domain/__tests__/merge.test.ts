import { describe, it, expect } from "vitest";
import { repointStepIngredient } from "../merge";
import type { Step } from "@/lib/db/schema";

const step = (id: string, quantities?: Step["quantities"]): Step => ({
  id,
  text: "do a thing {q1}",
  quantities,
});

describe("repointStepIngredient", () => {
  it("repoints matching ingredient ids and reports change", () => {
    const steps = [step("a", { q1: { ingredientId: 5, amount: 2, unit: "cup" } })];
    const result = repointStepIngredient(steps, 5, 9);

    expect(result.changed).toBe(true);
    expect(result.steps[0].quantities!.q1.ingredientId).toBe(9);
    // amount/unit untouched
    expect(result.steps[0].quantities!.q1.amount).toBe(2);
  });

  it("leaves non-matching references and reports no change", () => {
    const steps = [step("a", { q1: { ingredientId: 7, amount: 1, unit: null } })];
    const result = repointStepIngredient(steps, 5, 9);

    expect(result.changed).toBe(false);
    expect(result.steps).toBe(steps); // same reference when nothing changed
  });

  it("handles steps without quantities", () => {
    const steps = [step("a"), step("b", { q1: { ingredientId: 5, amount: 3, unit: "g" } })];
    const result = repointStepIngredient(steps, 5, 9);

    expect(result.changed).toBe(true);
    expect(result.steps[0]).toBe(steps[0]); // untouched step keeps its reference
    expect(result.steps[1].quantities!.q1.ingredientId).toBe(9);
  });

  it("does not mutate the input", () => {
    const steps = [step("a", { q1: { ingredientId: 5, amount: 2, unit: "cup" } })];
    repointStepIngredient(steps, 5, 9);
    expect(steps[0].quantities!.q1.ingredientId).toBe(5);
  });

  it("repoints multiple placeholders within one step", () => {
    const steps = [
      step("a", {
        q1: { ingredientId: 5, amount: 1, unit: "cup" },
        q2: { ingredientId: 5, amount: 2, unit: "tbsp" },
        q3: { ingredientId: 8, amount: 1, unit: null },
      }),
    ];
    const result = repointStepIngredient(steps, 5, 9);

    expect(result.changed).toBe(true);
    expect(result.steps[0].quantities!.q1.ingredientId).toBe(9);
    expect(result.steps[0].quantities!.q2.ingredientId).toBe(9);
    expect(result.steps[0].quantities!.q3.ingredientId).toBe(8);
  });
});

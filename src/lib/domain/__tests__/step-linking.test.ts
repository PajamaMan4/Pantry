import { describe, expect, it } from "vitest";
import { detectSpans, nearestIngredient } from "@/lib/domain/step-linking";

const EGG = { id: 1, name: "Egg" };
const MILK = { id: 2, name: "Milk" };
const FLOUR = { id: 3, name: "Flour" };
const WATER = { id: 4, name: "Water" };

describe("detectSpans — measurement ingredient is the one AFTER the amount (bug #1)", () => {
  it("links '2 cups' to milk, not the egg that precedes it", () => {
    const spans = detectSpans("Combine 1 egg and 2 cups milk.", [EGG, MILK]);
    const measure = spans.find((s) => s.unit === "cup");
    expect(measure).toBeDefined();
    expect(measure!.amount).toBe(2);
    expect(measure!.ingredientId).toBe(MILK.id);
  });

  it("prefers the following ingredient even when another appears earlier", () => {
    const spans = detectSpans("Mix the flour, then add 2 cups water.", [FLOUR, WATER]);
    const measure = spans.find((s) => s.unit === "cup");
    expect(measure!.ingredientId).toBe(WATER.id);
  });

  it("nearestIngredient prefers after, falls back to before", () => {
    const text = "flour ... water";
    expect(nearestIngredient(text, text.indexOf("water"), [FLOUR, WATER])).toBe(WATER.id);
    // nothing after this point → falls back to the nearest before
    expect(nearestIngredient("add water then mix", 99, [WATER])).toBe(WATER.id);
  });
});

describe("detectSpans — count amounts like '1 egg' / '1 bread' (bug #2)", () => {
  it("detects a bare count and links it to the matching ingredient", () => {
    const spans = detectSpans("Combine 1 egg and 2 cups milk.", [EGG, MILK]);
    const count = spans.find((s) => s.unit === "each");
    expect(count).toBeDefined();
    expect(count!.amount).toBe(1);
    expect(count!.label).toBe("1 egg");
    expect(count!.ingredientId).toBe(EGG.id);
    // replaces ONLY the number, leaving the noun as prose
    expect(count!.replaceLength).toBe(1);
  });

  it("detects a count even when the noun is not a known ingredient", () => {
    const spans = detectSpans("Toast 1 bread.", []);
    expect(spans).toHaveLength(1);
    expect(spans[0].unit).toBe("each");
    expect(spans[0].amount).toBe(1);
    expect(spans[0].ingredientId).toBeNull();
  });

  it("handles count ranges", () => {
    const spans = detectSpans("Add 2-3 eggs.", [EGG]);
    const count = spans.find((s) => s.unit === "each")!;
    expect(count.amount).toBe(2);
    expect(count.amountMax).toBe(3);
    expect(count.ingredientId).toBe(EGG.id);
  });
});

describe("detectSpans — safety: never detect times or temperatures", () => {
  it("ignores oven temps and durations", () => {
    expect(detectSpans("Bake at 350°F for 20 minutes.", [])).toEqual([]);
    expect(detectSpans("Rest 5 min, then chill 2 hours.", [])).toEqual([]);
  });

  it("does not double-count a measurement as a count", () => {
    const spans = detectSpans("Add 2 cups milk.", [MILK]);
    expect(spans).toHaveLength(1);
    expect(spans[0].unit).toBe("cup");
  });
});

describe("detectSpans — applying a replacement", () => {
  it("replaces just the number for a count", () => {
    const text = "Beat 2 eggs well.";
    const span = detectSpans(text, [EGG])[0];
    const replaced = text.slice(0, span.replaceStart) + "{q1}" + text.slice(span.replaceStart + span.replaceLength);
    expect(replaced).toBe("Beat {q1} eggs well.");
  });
});

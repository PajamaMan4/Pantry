import { describe, expect, it } from "vitest";
import {
  formatNumber,
  unitLabel,
  formatQuantityText,
  totalTimeMin,
  formatMinutes,
  renderStepText,
} from "@/lib/domain/format";

describe("formatNumber", () => {
  it("drops trailing zeros and rounds to 2dp", () => {
    expect(formatNumber(2)).toBe("2");
    expect(formatNumber(1.5)).toBe("1.5");
    expect(formatNumber(0.333333)).toBe("0.33");
  });
});

describe("formatQuantityText", () => {
  it("formats amount + unit", () => {
    expect(formatQuantityText({ amount: 2, unit: "cup" })).toBe("2 cup");
    expect(formatQuantityText({ amount: 0.5, unit: "tsp" })).toBe("0.5 tsp");
  });

  it("formats ranges", () => {
    expect(formatQuantityText({ amount: 2, amountMax: 3, unit: null })).toBe("2–3");
  });

  it("falls back to the raw descriptor when amount is null", () => {
    expect(formatQuantityText({ amount: null, unit: null, raw: "to taste" })).toBe("to taste");
    expect(formatQuantityText({ amount: null, unit: null })).toBe("");
  });

  it("uses the unit label, not the id", () => {
    expect(unitLabel("fl_oz")).toBe("fl oz");
    expect(formatQuantityText({ amount: 1, unit: "fl_oz" })).toBe("1 fl oz");
  });
});

describe("renderStepText", () => {
  it("substitutes {qN} placeholders with stored amounts, leaving prose untouched", () => {
    const step = {
      text: "Pour {q1} batter and cook at 350°F for 2 minutes.",
      quantities: { q1: { amount: 0.25, unit: "cup" } },
    };
    expect(renderStepText(step)).toBe("Pour 0.25 cup batter and cook at 350°F for 2 minutes.");
  });

  it("returns text unchanged when there are no quantities", () => {
    expect(renderStepText({ text: "Stir well." })).toBe("Stir well.");
  });

  it("leaves an unmatched placeholder in place", () => {
    expect(renderStepText({ text: "Add {q9}.", quantities: { q1: { amount: 1, unit: null } } })).toBe(
      "Add {q9}.",
    );
  });
});

describe("time helpers", () => {
  it("derives total time and treats both-null as null", () => {
    expect(totalTimeMin(10, 15)).toBe(25);
    expect(totalTimeMin(null, 20)).toBe(20);
    expect(totalTimeMin(null, null)).toBeNull();
  });

  it("formats minutes into h/min", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(90)).toBe("1 h 30 min");
    expect(formatMinutes(null)).toBe("—");
  });
});

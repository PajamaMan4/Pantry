import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  isSectioned,
  flattenGroups,
  toSections,
  groupRowsBySection,
  ingredientGroupsSchema,
  type IngredientGroups,
} from "@/lib/domain/sections";

type Ing = { name: string; amount: number };
const flat: Ing[] = [
  { name: "flour", amount: 250 },
  { name: "butter", amount: 125 },
];
const sectioned: IngredientGroups<Ing> = [
  { title: "For the crust", ingredients: [{ name: "flour", amount: 250 }, { name: "butter", amount: 125 }] },
  { title: "For the filling", ingredients: [{ name: "butter", amount: 100 }, { name: "egg", amount: 3 }] },
];

describe("isSectioned", () => {
  it("is false for a flat array and true for a sectioned one", () => {
    expect(isSectioned(flat)).toBe(false);
    expect(isSectioned(sectioned)).toBe(true);
  });
  it("treats an empty list as flat (nothing to group)", () => {
    expect(isSectioned([])).toBe(false);
  });
});

describe("flattenGroups", () => {
  it("returns a flat list unchanged", () => {
    expect(flattenGroups(flat)).toEqual(flat);
  });
  it("concatenates section ingredients in order (duplicates preserved)", () => {
    expect(flattenGroups<Ing>(sectioned).map((i) => i.name)).toEqual(["flour", "butter", "butter", "egg"]);
  });
});

describe("toSections", () => {
  it("wraps a flat list in a single null-titled section", () => {
    expect(toSections(flat)).toEqual([{ title: null, ingredients: flat }]);
  });
  it("preserves section titles", () => {
    expect(toSections(sectioned).map((s) => s.title)).toEqual(["For the crust", "For the filling"]);
  });
});

describe("groupRowsBySection", () => {
  it("makes one null-titled group when every row is ungrouped", () => {
    const rows = [{ t: null }, { t: null }];
    const groups = groupRowsBySection(rows, (r) => r.t);
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBeNull();
    expect(groups[0].items.map((i) => i.index)).toEqual([0, 1]);
  });
  it("splits contiguous rows by title and keeps original indices", () => {
    const rows = [
      { t: "A" }, // 0
      { t: "A" }, // 1
      { t: "B" }, // 2
    ];
    const groups = groupRowsBySection(rows, (r) => r.t);
    expect(groups.map((g) => g.title)).toEqual(["A", "B"]);
    expect(groups[0].items.map((i) => i.index)).toEqual([0, 1]);
    expect(groups[1].items.map((i) => i.index)).toEqual([2]);
  });
});

describe("ingredientGroupsSchema — parsing flat / sectioned / malformed", () => {
  const item = z.object({ name: z.string().min(1), amount: z.number().nullable() });
  const schema = ingredientGroupsSchema(item);

  it("accepts a flat array", () => {
    const r = schema.safeParse([{ name: "flour", amount: 250 }]);
    expect(r.success).toBe(true);
  });

  it("accepts a sectioned array", () => {
    const r = schema.safeParse([
      { title: "For the crust", ingredients: [{ name: "flour", amount: 250 }] },
    ]);
    expect(r.success).toBe(true);
  });

  it("rejects a section missing its title (clear failure, not silent)", () => {
    const r = schema.safeParse([{ ingredients: [{ name: "flour", amount: 250 }] }]);
    expect(r.success).toBe(false);
  });

  it("rejects a malformed ingredient object", () => {
    const r = schema.safeParse([{ name: "", amount: "lots" }]);
    expect(r.success).toBe(false);
  });
});

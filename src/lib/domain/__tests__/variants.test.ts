import { describe, expect, it } from "vitest";
import { collapseIntoGroups, type GroupRef } from "@/lib/domain/variants";

type Item = { id: number; group: GroupRef | null };
const getGroup = (i: Item) => i.group;

const alfredo: GroupRef = { id: 1, name: "Alfredo Pasta" };
const curry: GroupRef = { id: 2, name: "Curry" };

describe("collapseIntoGroups", () => {
  it("leaves ungrouped items as single rows", () => {
    const rows = collapseIntoGroups<Item>([{ id: 1, group: null }, { id: 2, group: null }], getGroup);
    expect(rows.map((r) => r.kind)).toEqual(["single", "single"]);
  });

  it("folds 2+ members of the same group into one group row", () => {
    const rows = collapseIntoGroups<Item>(
      [{ id: 10, group: alfredo }, { id: 11, group: alfredo }],
      getGroup,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("group");
    const row = rows[0] as Extract<(typeof rows)[number], { kind: "group" }>;
    expect(row.group).toEqual(alfredo);
    expect(row.members.map((m) => m.id)).toEqual([10, 11]);
  });

  it("renders a lone matching member as a single row (group not shown)", () => {
    // Only one Alfredo survived the search/filters -> no group card.
    const rows = collapseIntoGroups<Item>([{ id: 10, group: alfredo }], getGroup);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("single");
  });

  it("places the group row at its best-ranked member's position and preserves order", () => {
    const rows = collapseIntoGroups<Item>(
      [
        { id: 1, group: null }, // 0
        { id: 10, group: alfredo }, // group first appears here
        { id: 2, group: null },
        { id: 11, group: alfredo }, // folds into the row above
      ],
      getGroup,
    );
    expect(rows.map((r) => r.kind)).toEqual(["single", "group", "single"]);
    const group = rows[1] as Extract<(typeof rows)[number], { kind: "group" }>;
    expect(group.members.map((m) => m.id)).toEqual([10, 11]);
  });

  it("keeps distinct groups separate", () => {
    const rows = collapseIntoGroups<Item>(
      [
        { id: 10, group: alfredo },
        { id: 20, group: curry },
        { id: 11, group: alfredo },
        { id: 21, group: curry },
      ],
      getGroup,
    );
    expect(rows.map((r) => r.kind)).toEqual(["group", "group"]);
  });
});

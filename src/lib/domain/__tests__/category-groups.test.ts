import { describe, expect, it } from "vitest";
import { groupByCategory, UNCATEGORIZED_LABEL } from "@/lib/domain/category-groups";

type Item = { id: number; category: string | null };
const item = (id: number, category: string | null): Item => ({ id, category });

describe("groupByCategory", () => {
  it("returns no groups for an empty list", () => {
    expect(groupByCategory<Item>([], (i) => i.category)).toEqual([]);
  });

  it("buckets null categories into an Uncategorized group sorted last", () => {
    const items = [item(1, "dairy"), item(2, null)];
    const groups = groupByCategory(items, (i) => i.category);
    expect(groups.map((g) => g.name)).toEqual(["Dairy", UNCATEGORIZED_LABEL]);
    expect(groups[1].items).toEqual([item(2, null)]);
  });

  it("treats a blank string the same as null", () => {
    const items = [item(1, "dairy"), item(2, "   ")];
    const groups = groupByCategory(items, (i) => i.category);
    expect(groups.map((g) => g.name)).toEqual(["Dairy", UNCATEGORIZED_LABEL]);
  });

  it("orders groups alphabetically by Title Case name", () => {
    const items = [item(1, "produce"), item(2, "dairy"), item(3, "meat")];
    const groups = groupByCategory(items, (i) => i.category);
    expect(groups.map((g) => g.name)).toEqual(["Dairy", "Meat", "Produce"]);
  });

  it("merges categories that differ only by case", () => {
    const items = [item(1, "Dairy"), item(2, "dairy"), item(3, "DAIRY")];
    const groups = groupByCategory(items, (i) => i.category);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ name: "Dairy" });
    expect(groups[0].items).toHaveLength(3);
  });

  it("preserves item order within a group", () => {
    const items = [item(1, "dairy"), item(2, "dairy"), item(3, "dairy")];
    const groups = groupByCategory(items, (i) => i.category);
    expect(groups[0].items.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it("Title Cases multi-word categories", () => {
    const items = [item(1, "grains & pasta")];
    const groups = groupByCategory(items, (i) => i.category);
    expect(groups[0].name).toBe("Grains & Pasta");
  });
});

import { describe, expect, it } from "vitest";
import { groupByLocation, UNSORTED_LABEL, type LocationRef } from "@/lib/domain/location-groups";

type Item = { id: number; location: LocationRef };
const item = (id: number, location: LocationRef): Item => ({ id, location });

describe("groupByLocation", () => {
  it("returns no groups for an empty list", () => {
    expect(groupByLocation<Item>([], (i) => i.location)).toEqual([]);
  });

  it("buckets null locations into an Unsorted group sorted last", () => {
    const items = [item(1, { name: "Fridge", sortOrder: 0 }), item(2, null)];
    const groups = groupByLocation(items, (i) => i.location);
    expect(groups.map((g) => g.name)).toEqual(["Fridge", UNSORTED_LABEL]);
    expect(groups[1].items).toEqual([item(2, null)]);
  });

  it("orders groups by sortOrder ascending", () => {
    const items = [
      item(1, { name: "Pantry", sortOrder: 2 }),
      item(2, { name: "Fridge", sortOrder: 0 }),
      item(3, { name: "Freezer", sortOrder: 1 }),
    ];
    const groups = groupByLocation(items, (i) => i.location);
    expect(groups.map((g) => g.name)).toEqual(["Fridge", "Freezer", "Pantry"]);
  });

  it("breaks ties on equal sortOrder by name", () => {
    const items = [
      item(1, { name: "Pantry", sortOrder: 0 }),
      item(2, { name: "Fridge", sortOrder: 0 }),
    ];
    const groups = groupByLocation(items, (i) => i.location);
    expect(groups.map((g) => g.name)).toEqual(["Fridge", "Pantry"]);
  });

  it("preserves item order within a group", () => {
    const items = [
      item(1, { name: "Fridge", sortOrder: 0 }),
      item(2, { name: "Fridge", sortOrder: 0 }),
      item(3, { name: "Fridge", sortOrder: 0 }),
    ];
    const groups = groupByLocation(items, (i) => i.location);
    expect(groups[0].items.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it("groups multiple items sharing a location under one entry with the right count", () => {
    const items = [
      item(1, { name: "Fridge", sortOrder: 0 }),
      item(2, { name: "Pantry", sortOrder: 1 }),
      item(3, { name: "Fridge", sortOrder: 0 }),
    ];
    const groups = groupByLocation(items, (i) => i.location);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ name: "Fridge", sortOrder: 0 });
    expect(groups[0].items).toHaveLength(2);
  });
});

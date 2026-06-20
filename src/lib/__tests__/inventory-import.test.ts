import { describe, expect, it } from "vitest";
import { inventoryImportSchema, normalizeImportItems } from "@/lib/inventory-import";
import { normalizeUnit } from "@/lib/import/normalize-unit";

const base = { pantryVersion: 1 as const };

describe("inventoryImportSchema — valid cases", () => {
  it("accepts a price-only item", () => {
    const r = inventoryImportSchema.safeParse({
      ...base,
      items: [{ name: "flour", cost: 2.0, costUnit: "kg" }],
    });
    expect(r.success).toBe(true);
  });

  it("accepts an inventory-only item", () => {
    const r = inventoryImportSchema.safeParse({
      ...base,
      items: [{ name: "rice", addQuantity: 2, addUnit: "kg" }],
    });
    expect(r.success).toBe(true);
  });

  it("accepts an item with both price and inventory", () => {
    const r = inventoryImportSchema.safeParse({
      ...base,
      items: [{ name: "eggs", cost: 0.3, costUnit: "each", addQuantity: 12, addUnit: "each" }],
    });
    expect(r.success).toBe(true);
  });

  it("accepts multiple items in one file", () => {
    const r = inventoryImportSchema.safeParse({
      ...base,
      items: [
        { name: "flour", cost: 2.0, costUnit: "kg" },
        { name: "rice", addQuantity: 1, addUnit: "kg", location: "Pantry" },
        { name: "butter", cost: 5.5, costUnit: "lb", addQuantity: 250, addUnit: "g" },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("accepts optional fields: store, purchasedAt, location", () => {
    const r = inventoryImportSchema.safeParse({
      ...base,
      items: [
        {
          name: "olive oil",
          cost: 12,
          costUnit: "l",
          store: "Costco",
          purchasedAt: "2026-06-18",
          addQuantity: 1,
          addUnit: "l",
          location: "Pantry",
        },
      ],
    });
    expect(r.success).toBe(true);
  });
});

describe("inventoryImportSchema — invalid cases", () => {
  it("rejects an item with neither cost nor addQuantity", () => {
    const r = inventoryImportSchema.safeParse({
      ...base,
      items: [{ name: "mystery" }],
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/cost or addQuantity/);
  });

  it("rejects cost without costUnit", () => {
    const r = inventoryImportSchema.safeParse({
      ...base,
      items: [{ name: "flour", cost: 2.0 }],
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/costUnit is required/);
  });

  it("rejects addQuantity without addUnit", () => {
    const r = inventoryImportSchema.safeParse({
      ...base,
      items: [{ name: "flour", addQuantity: 500 }],
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/addUnit is required/);
  });

  it("rejects an unrecognized costUnit", () => {
    const r = inventoryImportSchema.safeParse({
      ...base,
      items: [{ name: "flour", cost: 2.0, costUnit: "stone" }],
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/unrecognized costUnit/);
  });

  it("rejects an unrecognized addUnit", () => {
    const r = inventoryImportSchema.safeParse({
      ...base,
      items: [{ name: "flour", addQuantity: 500, addUnit: "bushel" }],
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/unrecognized addUnit/);
  });

  it("rejects an empty items array", () => {
    const r = inventoryImportSchema.safeParse({ ...base, items: [] });
    expect(r.success).toBe(false);
  });

  it("rejects wrong pantryVersion", () => {
    const r = inventoryImportSchema.safeParse({
      pantryVersion: 2,
      items: [{ name: "flour", cost: 2, costUnit: "kg" }],
    });
    expect(r.success).toBe(false);
  });
});

describe("normalizeUnit", () => {
  it("maps friendly words to canonical ids", () => {
    expect(normalizeUnit("kilogram")).toBe("kg");
    expect(normalizeUnit("kilograms")).toBe("kg");
    expect(normalizeUnit("kilo")).toBe("kg");
    expect(normalizeUnit("grams")).toBe("g");
    expect(normalizeUnit("cups")).toBe("cup");
    expect(normalizeUnit("tablespoon")).toBe("tbsp");
    expect(normalizeUnit("pounds")).toBe("lb");
    expect(normalizeUnit("ounces")).toBe("oz");
    expect(normalizeUnit("litre")).toBe("l");
  });

  it("is case-insensitive", () => {
    expect(normalizeUnit("KG")).toBe("kg");
    expect(normalizeUnit("Cup")).toBe("cup");
    expect(normalizeUnit("GRAMS")).toBe("g");
  });

  it("returns null for unrecognized units", () => {
    expect(normalizeUnit("stone")).toBeNull();
    expect(normalizeUnit("bushel")).toBeNull();
  });

  it("returns null for null/undefined/empty", () => {
    expect(normalizeUnit(null)).toBeNull();
    expect(normalizeUnit(undefined)).toBeNull();
    expect(normalizeUnit("")).toBeNull();
  });
});

describe("normalizeImportItems", () => {
  it("normalizes unit words to canonical ids", () => {
    const file = inventoryImportSchema.parse({
      ...base,
      items: [{ name: "flour", cost: 2, costUnit: "kilogram", addQuantity: 500, addUnit: "grams" }],
    });
    const items = normalizeImportItems(file);
    expect(items[0].costUnit).toBe("kg");
    expect(items[0].addUnit).toBe("g");
  });

  it("sets null for absent optional fields", () => {
    const file = inventoryImportSchema.parse({
      ...base,
      items: [{ name: "eggs", cost: 0.3, costUnit: "each" }],
    });
    const items = normalizeImportItems(file);
    expect(items[0].addQuantity).toBeNull();
    expect(items[0].addUnit).toBeNull();
    expect(items[0].store).toBeNull();
    expect(items[0].location).toBeNull();
  });
});

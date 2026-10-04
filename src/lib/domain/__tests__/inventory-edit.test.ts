import { describe, expect, it } from "vitest";
import {
  buildInventoryEditPayload,
  findMergePreviewKeys,
  isBlankNewLine,
  isInventoryDraftDirty,
  newLine,
  planInventoryEdit,
  seedToLine,
  summarizeInventoryDraft,
  type DraftLine,
  type ExistingLine,
  type InventoryEditSeed,
  type InventorySnapshotRow,
} from "@/lib/domain/inventory-edit";

function seed(p: Partial<InventoryEditSeed> & { id: number }): InventoryEditSeed {
  return {
    ingredientId: p.id,
    ingredientName: `ing-${p.id}`,
    category: null,
    quantity: 1,
    unit: "cup",
    locationId: null,
    ...p,
  };
}

function row(p: Partial<InventorySnapshotRow> & { id: number }): InventorySnapshotRow {
  return { ingredientId: p.id, locationId: null, quantity: 1, unit: "cup", ...p };
}

describe("seedToLine / newLine / isBlankNewLine", () => {
  it("carries every seed field into the draft with matching original + editable copies", () => {
    const line = seedToLine(seed({ id: 5, quantity: 2, unit: "g", locationId: 3 }));
    expect(line).toMatchObject({
      kind: "existing",
      key: "db:5",
      id: 5,
      amount: "2",
      unit: "g",
      locationId: 3,
      deleted: false,
      original: { quantity: 2, unit: "g", locationId: 3 },
    });
  });

  it("a fresh new line is blank", () => {
    expect(isBlankNewLine(newLine(null, "k1"))).toBe(true);
  });

  it("a new line with only an amount typed is not blank", () => {
    const l = { ...newLine(null, "k1"), amount: "2" };
    expect(isBlankNewLine(l)).toBe(false);
  });

  it("rounds a long-decimal quantity to 2 places in both the draft and its dirty-check baseline", () => {
    const line = seedToLine(seed({ id: 6, quantity: 2.3333333333 }));
    expect(line.amount).toBe("2.33");
    expect(line.original.quantity).toBe(2.33);
  });

  it("does not pad a quantity that already has fewer than 2 decimals", () => {
    const line = seedToLine(seed({ id: 7, quantity: 1.5 }));
    expect(line.amount).toBe("1.5");
    expect(line.original.quantity).toBe(1.5);
  });

  it("a freshly loaded long-decimal line is not dirty and produces no update", () => {
    const lines: DraftLine[] = [seedToLine(seed({ id: 8, quantity: 2.3333333333 }))];
    expect(isInventoryDraftDirty(lines)).toBe(false);
    const built = buildInventoryEditPayload(lines);
    expect(built.ok).toBe(true);
    if (built.ok) expect(built.payload.updates).toHaveLength(0);
  });
});

describe("isInventoryDraftDirty / summarizeInventoryDraft", () => {
  const pristine: DraftLine[] = [seedToLine(seed({ id: 1, quantity: 2, unit: "g", locationId: 1 }))];

  it("pristine seeds are not dirty", () => {
    expect(isInventoryDraftDirty(pristine)).toBe(false);
    expect(summarizeInventoryDraft(pristine)).toEqual({ edited: 0, removed: 0, added: 0 });
  });

  it("a freshly appended blank new line does not count as dirty", () => {
    const lines = [...pristine, newLine(1, "new1")];
    expect(isInventoryDraftDirty(lines)).toBe(false);
    expect(summarizeInventoryDraft(lines)).toEqual({ edited: 0, removed: 0, added: 0 });
  });

  it("editing amount marks dirty and edited", () => {
    const l = { ...(pristine[0] as ExistingLine), amount: "5" };
    expect(isInventoryDraftDirty([l])).toBe(true);
    expect(summarizeInventoryDraft([l])).toEqual({ edited: 1, removed: 0, added: 0 });
  });

  it("editing unit marks dirty and edited", () => {
    const l = { ...(pristine[0] as ExistingLine), unit: "oz" };
    expect(isInventoryDraftDirty([l])).toBe(true);
    expect(summarizeInventoryDraft([l])).toEqual({ edited: 1, removed: 0, added: 0 });
  });

  it("moving (changing locationId) marks dirty and edited", () => {
    const l = { ...(pristine[0] as ExistingLine), locationId: 2 };
    expect(isInventoryDraftDirty([l])).toBe(true);
    expect(summarizeInventoryDraft([l])).toEqual({ edited: 1, removed: 0, added: 0 });
  });

  it("deleting marks dirty and removed", () => {
    const l = { ...(pristine[0] as ExistingLine), deleted: true };
    expect(isInventoryDraftDirty([l])).toBe(true);
    expect(summarizeInventoryDraft([l])).toEqual({ edited: 0, removed: 1, added: 0 });
  });

  it("a filled-in new line marks dirty and added", () => {
    const l = { ...newLine(1, "new1"), ingredientId: 9, ingredientName: "Sugar", amount: "1", unit: "cup" };
    expect(isInventoryDraftDirty([l])).toBe(true);
    expect(summarizeInventoryDraft([l])).toEqual({ edited: 0, removed: 0, added: 1 });
  });
});

describe("findMergePreviewKeys", () => {
  it("flags two new lines that collide on ingredient+location+unit", () => {
    const a = { ...newLine(1, "a"), ingredientId: 9, ingredientName: "Sugar", amount: "1", unit: "cup" };
    const b = { ...newLine(1, "b"), ingredientId: 9, ingredientName: "Sugar", amount: "2", unit: "cup" };
    expect(findMergePreviewKeys([a, b])).toEqual(new Set(["a", "b"]));
  });

  it("does not flag lines differing only in unit", () => {
    const a = { ...newLine(1, "a"), ingredientId: 9, ingredientName: "Sugar", amount: "1", unit: "cup" };
    const b = { ...newLine(1, "b"), ingredientId: 9, ingredientName: "Sugar", amount: "2", unit: "g" };
    expect(findMergePreviewKeys([a, b]).size).toBe(0);
  });

  it("ignores a deleted existing line as a merge target", () => {
    const existing = { ...seedToLine(seed({ id: 1, unit: "cup", locationId: 1 })), deleted: true };
    const created = { ...newLine(1, "n"), ingredientId: 1, ingredientName: "ing-1", amount: "1", unit: "cup" };
    expect(findMergePreviewKeys([existing, created]).size).toBe(0);
  });
});

describe("buildInventoryEditPayload", () => {
  it("only changed existing lines reach updates; unchanged ones are absent", () => {
    const unchanged = seedToLine(seed({ id: 1, quantity: 2, unit: "g", locationId: 1 }));
    const changed = { ...seedToLine(seed({ id: 2, quantity: 2, unit: "g", locationId: 1 })), amount: "3" };
    const res = buildInventoryEditPayload([unchanged, changed]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.payload.updates).toEqual([{ id: 2, quantity: 3, unit: "g", locationId: 1 }]);
    }
  });

  it("a moved line produces an update with the new locationId", () => {
    const moved = { ...seedToLine(seed({ id: 1, quantity: 2, unit: "g", locationId: 1 })), locationId: 2 };
    const res = buildInventoryEditPayload([moved]);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.payload.updates).toEqual([{ id: 1, quantity: 2, unit: "g", locationId: 2 }]);
  });

  it("a soft-deleted existing line goes to deletes, never also updates", () => {
    const l = { ...seedToLine(seed({ id: 1, quantity: 2, unit: "g", locationId: 1 })), deleted: true, amount: "9" };
    const res = buildInventoryEditPayload([l]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.payload.deletes).toEqual([1]);
      expect(res.payload.updates).toEqual([]);
    }
  });

  it("an entirely blank new line is ignored", () => {
    const res = buildInventoryEditPayload([newLine(1, "a")]);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.payload).toEqual({ updates: [], deletes: [], creates: [] });
  });

  it("a partially filled new line errors, naming the missing piece and returning key/location", () => {
    const l = { ...newLine(3, "a"), amount: "2" }; // no ingredient
    const res = buildInventoryEditPayload([l]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.key).toBe("a");
      expect(res.locationId).toBe(3);
      expect(res.error).toMatch(/ingredient/i);
    }
  });

  it("blank amount on an existing line errors", () => {
    const l = { ...seedToLine(seed({ id: 1 })), amount: "" };
    const res = buildInventoryEditPayload([l]);
    expect(res.ok).toBe(false);
  });

  it("negative amount on an existing line errors", () => {
    const l = { ...seedToLine(seed({ id: 1 })), amount: "-1" };
    const res = buildInventoryEditPayload([l]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/negative/i);
  });

  it("NaN amount on an existing line errors", () => {
    const l = { ...seedToLine(seed({ id: 1 })), amount: "abc" };
    const res = buildInventoryEditPayload([l]);
    expect(res.ok).toBe(false);
  });

  it("quantity 0 is accepted on an existing line", () => {
    const l = { ...seedToLine(seed({ id: 1, quantity: 2 })), amount: "0" };
    const res = buildInventoryEditPayload([l]);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.payload.updates[0]?.quantity).toBe(0);
  });

  it("quantity 0 is rejected on a new line", () => {
    const l = { ...newLine(1, "a"), ingredientId: 9, ingredientName: "Sugar", amount: "0", unit: "cup" };
    const res = buildInventoryEditPayload([l]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/greater than 0/i);
  });

  it("new line with no unit errors", () => {
    const l = { ...newLine(1, "a"), ingredientId: 9, ingredientName: "Sugar", amount: "1", unit: "" };
    const res = buildInventoryEditPayload([l]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/unit/i);
  });

  it("new line with no ingredientId errors", () => {
    const l = { ...newLine(1, "a"), ingredientName: "typed but not picked", amount: "1", unit: "cup" };
    const res = buildInventoryEditPayload([l]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/ingredient/i);
  });
});

describe("planInventoryEdit — updates", () => {
  it("update-only produces one update op with final values, no inserts", () => {
    const snapshot = [row({ id: 1, quantity: 2, unit: "g" })];
    const { plan, conflicts } = planInventoryEdit(snapshot, {
      updates: [{ id: 1, quantity: 5, unit: "g", locationId: null }],
      deletes: [],
      creates: [],
    });
    expect(conflicts).toEqual([]);
    expect(plan.updates).toEqual([{ id: 1, quantity: 5, unit: "g", locationId: null }]);
    expect(plan.inserts).toEqual([]);
  });

  it("an update identical to the snapshot is dropped (no updatedAt churn)", () => {
    const snapshot = [row({ id: 1, quantity: 2, unit: "g", locationId: 1 })];
    const { plan } = planInventoryEdit(snapshot, {
      updates: [{ id: 1, quantity: 2, unit: "g", locationId: 1 }],
      deletes: [],
      creates: [],
    });
    expect(plan.updates).toEqual([]);
  });

  it("update for an unknown id is reported as a conflict", () => {
    const { conflicts } = planInventoryEdit([], {
      updates: [{ id: 99, quantity: 1, unit: "g", locationId: null }],
      deletes: [],
      creates: [],
    });
    expect(conflicts).toEqual([99]);
  });
});

describe("planInventoryEdit — deletes", () => {
  it("delete produces a delete op and drops a same-id update (delete wins)", () => {
    const snapshot = [row({ id: 1, quantity: 2, unit: "g" })];
    const { plan, conflicts } = planInventoryEdit(snapshot, {
      updates: [{ id: 1, quantity: 5, unit: "g", locationId: null }],
      deletes: [1],
      creates: [],
    });
    expect(conflicts).toEqual([]);
    expect(plan.deletes).toEqual([1]);
    expect(plan.updates).toEqual([]);
  });

  it("delete for an unknown id is ignored, no conflict", () => {
    const { plan, conflicts } = planInventoryEdit([], { updates: [], deletes: [99], creates: [] });
    expect(conflicts).toEqual([]);
    expect(plan.deletes).toEqual([]);
  });
});

describe("planInventoryEdit — creates & merging", () => {
  it("create with no match produces an insert", () => {
    const { plan } = planInventoryEdit([], {
      updates: [],
      deletes: [],
      creates: [{ ingredientId: 1, quantity: 1, unit: "g", locationId: null }],
    });
    expect(plan.inserts).toEqual([{ ingredientId: 1, locationId: null, quantity: 1, unit: "g" }]);
    expect(plan.merged).toBe(0);
  });

  it("create matching an untouched row merges into it", () => {
    const snapshot = [row({ id: 1, ingredientId: 1, quantity: 2, unit: "g", locationId: null })];
    const { plan } = planInventoryEdit(snapshot, {
      updates: [],
      deletes: [],
      creates: [{ ingredientId: 1, quantity: 3, unit: "g", locationId: null }],
    });
    expect(plan.updates).toEqual([{ id: 1, quantity: 5, unit: "g", locationId: null }]);
    expect(plan.inserts).toEqual([]);
    expect(plan.merged).toBe(1);
  });

  it("create merging into a row whose quantity was also edited sums onto the edited value", () => {
    const snapshot = [row({ id: 1, ingredientId: 1, quantity: 2, unit: "g", locationId: null })];
    const { plan } = planInventoryEdit(snapshot, {
      updates: [{ id: 1, quantity: 10, unit: "g", locationId: null }],
      deletes: [],
      creates: [{ ingredientId: 1, quantity: 3, unit: "g", locationId: null }],
    });
    expect(plan.updates).toEqual([{ id: 1, quantity: 13, unit: "g", locationId: null }]);
    expect(plan.merged).toBe(1);
  });

  it("create matches a row whose unit was edited to match", () => {
    const snapshot = [row({ id: 1, ingredientId: 1, quantity: 2, unit: "oz", locationId: null })];
    const { plan } = planInventoryEdit(snapshot, {
      updates: [{ id: 1, quantity: 2, unit: "g", locationId: null }],
      deletes: [],
      creates: [{ ingredientId: 1, quantity: 3, unit: "g", locationId: null }],
    });
    expect(plan.updates).toEqual([{ id: 1, quantity: 5, unit: "g", locationId: null }]);
    expect(plan.merged).toBe(1);
  });

  it("create does not match a row whose unit was edited away", () => {
    const snapshot = [row({ id: 1, ingredientId: 1, quantity: 2, unit: "g", locationId: null })];
    const { plan } = planInventoryEdit(snapshot, {
      updates: [{ id: 1, quantity: 2, unit: "oz", locationId: null }],
      deletes: [],
      creates: [{ ingredientId: 1, quantity: 3, unit: "g", locationId: null }],
    });
    expect(plan.inserts).toEqual([{ ingredientId: 1, locationId: null, quantity: 3, unit: "g" }]);
    expect(plan.merged).toBe(0);
  });

  it("create matches a row an update moved into this location", () => {
    const snapshot = [row({ id: 1, ingredientId: 1, quantity: 2, unit: "g", locationId: 9 })];
    const { plan } = planInventoryEdit(snapshot, {
      updates: [{ id: 1, quantity: 2, unit: "g", locationId: 1 }],
      deletes: [],
      creates: [{ ingredientId: 1, quantity: 3, unit: "g", locationId: 1 }],
    });
    expect(plan.updates).toEqual([{ id: 1, quantity: 5, unit: "g", locationId: 1 }]);
    expect(plan.merged).toBe(1);
  });

  it("create does not match a row an update moved out of this location", () => {
    const snapshot = [row({ id: 1, ingredientId: 1, quantity: 2, unit: "g", locationId: 1 })];
    const { plan } = planInventoryEdit(snapshot, {
      updates: [{ id: 1, quantity: 2, unit: "g", locationId: 9 }],
      deletes: [],
      creates: [{ ingredientId: 1, quantity: 3, unit: "g", locationId: 1 }],
    });
    expect(plan.inserts).toEqual([{ ingredientId: 1, locationId: 1, quantity: 3, unit: "g" }]);
    expect(plan.merged).toBe(0);
  });

  it("delete then re-add the same ingredient/unit/location produces a delete + a fresh insert, never a merge", () => {
    const snapshot = [row({ id: 1, ingredientId: 1, quantity: 2, unit: "g", locationId: null })];
    const { plan } = planInventoryEdit(snapshot, {
      updates: [],
      deletes: [1],
      creates: [{ ingredientId: 1, quantity: 3, unit: "g", locationId: null }],
    });
    expect(plan.deletes).toEqual([1]);
    expect(plan.inserts).toEqual([{ ingredientId: 1, locationId: null, quantity: 3, unit: "g" }]);
    expect(plan.updates).toEqual([]);
    expect(plan.merged).toBe(0);
  });

  it("two creates with the same ingredient/unit/location collapse into one summed insert", () => {
    const { plan } = planInventoryEdit([], {
      updates: [],
      deletes: [],
      creates: [
        { ingredientId: 1, quantity: 1, unit: "g", locationId: null },
        { ingredientId: 1, quantity: 2, unit: "g", locationId: null },
      ],
    });
    expect(plan.inserts).toEqual([{ ingredientId: 1, locationId: null, quantity: 3, unit: "g" }]);
    expect(plan.merged).toBe(1);
  });

  it("two creates differing only in unit stay separate inserts", () => {
    const { plan } = planInventoryEdit([], {
      updates: [],
      deletes: [],
      creates: [
        { ingredientId: 1, quantity: 1, unit: "g", locationId: null },
        { ingredientId: 1, quantity: 2, unit: "oz", locationId: null },
      ],
    });
    expect(plan.inserts).toHaveLength(2);
    expect(plan.merged).toBe(0);
  });

  it("locationId null (Unsorted) matches only null, never a real location", () => {
    const snapshot = [row({ id: 1, ingredientId: 1, quantity: 2, unit: "g", locationId: 5 })];
    const { plan } = planInventoryEdit(snapshot, {
      updates: [],
      deletes: [],
      creates: [{ ingredientId: 1, quantity: 3, unit: "g", locationId: null }],
    });
    expect(plan.inserts).toEqual([{ ingredientId: 1, locationId: null, quantity: 3, unit: "g" }]);
    expect(plan.merged).toBe(0);
  });

  it("duplicate candidate rows in the snapshot: lowest id wins deterministically", () => {
    const snapshot = [
      row({ id: 5, ingredientId: 1, quantity: 1, unit: "g", locationId: null }),
      row({ id: 2, ingredientId: 1, quantity: 1, unit: "g", locationId: null }),
    ];
    const { plan } = planInventoryEdit(snapshot, {
      updates: [],
      deletes: [],
      creates: [{ ingredientId: 1, quantity: 3, unit: "g", locationId: null }],
    });
    expect(plan.updates).toEqual([{ id: 2, quantity: 4, unit: "g", locationId: null }]);
  });
});

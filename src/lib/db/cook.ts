import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import {
  recipes,
  recipeIngredients,
  ingredients,
  inventoryItems,
  cookLogs,
  cookLogLines,
  type CookLog,
} from "./schema";
import { getSettings } from "./settings";
import { listPriceEntriesFor } from "./prices";
import { recordTombstone } from "./tombstones";
import {
  planCook,
  applySubstitutions,
  type CookIngredientInput,
  type CookStockRow,
  type CookPlan,
  type CookDeduction,
  type ResolvedSubstitution,
} from "../domain/cook";
import { unitPrice, type PriceMode } from "../domain/cost";
import { convert } from "../domain/units";

export type CookData = {
  recipe: { id: number; name: string; baseServings: number };
  // `rowId` (recipe_ingredients row id) lets an in-view substitution target the
  // exact line it replaces; harmless extra field for callers that ignore it.
  ingredients: (CookIngredientInput & { rowId: number })[];
  stock: { ingredientId: number; rows: CookStockRow[] }[];
};

/** Everything the "I made this" preview + deduction needs for a recipe. */
export function getCookData(recipeId: number): CookData | undefined {
  const recipe = db
    .select({ id: recipes.id, name: recipes.name, baseServings: recipes.baseServings })
    .from(recipes)
    .where(eq(recipes.id, recipeId))
    .get();
  if (!recipe) return undefined;

  const rows = db
    .select({ ri: recipeIngredients, ing: ingredients })
    .from(recipeIngredients)
    .innerJoin(ingredients, eq(recipeIngredients.ingredientId, ingredients.id))
    .where(eq(recipeIngredients.recipeId, recipeId))
    .orderBy(asc(recipeIngredients.displayOrder))
    .all();

  const cookIngredients: (CookIngredientInput & { rowId: number })[] = rows.map(({ ri, ing }) => ({
    rowId: ri.id,
    ingredientId: ing.id,
    name: ing.name,
    amount: ri.amount,
    unit: ri.unit,
    optional: ri.optional,
    isStaple: ing.isStaple,
    density: ing.density,
    gramsPerEach: ing.gramsPerEach,
  }));

  const ids = [...new Set(cookIngredients.map((i) => i.ingredientId))];
  const invRows = ids.length
    ? db.select().from(inventoryItems).where(inArray(inventoryItems.ingredientId, ids)).all()
    : [];

  const stockMap = new Map<number, CookStockRow[]>();
  for (const r of invRows) {
    const arr = stockMap.get(r.ingredientId) ?? [];
    arr.push({ inventoryItemId: r.id, quantity: r.quantity, unit: r.unit, expiryMs: r.expiryDate?.getTime() ?? null });
    stockMap.set(r.ingredientId, arr);
  }

  return {
    recipe,
    ingredients: cookIngredients,
    stock: ids.map((id) => ({ ingredientId: id, rows: stockMap.get(id) ?? [] })),
  };
}

export type SubstituteInfo = {
  id: number;
  name: string;
  defaultUnit: string | null;
  density: number | null;
  gramsPerEach: number | null;
  isStaple: boolean;
  stock: CookStockRow[];
};

/**
 * Everything a temporary in-view ingredient swap needs to behave like a
 * first-class line: the substitute's conversion factors (density/gramsPerEach)
 * and its current inventory rows, so scaling + stock status keep working.
 * Read-only — substitutions are never persisted.
 */
export function getSubstituteInfo(ingredientId: number): SubstituteInfo | undefined {
  const ing = db
    .select({
      id: ingredients.id,
      name: ingredients.name,
      defaultUnit: ingredients.defaultUnit,
      density: ingredients.density,
      gramsPerEach: ingredients.gramsPerEach,
      isStaple: ingredients.isStaple,
    })
    .from(ingredients)
    .where(eq(ingredients.id, ingredientId))
    .get();
  if (!ing) return undefined;

  const invRows = db
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.ingredientId, ingredientId))
    .all();
  const stock: CookStockRow[] = invRows.map((r) => ({
    inventoryItemId: r.id,
    quantity: r.quantity,
    unit: r.unit,
    expiryMs: r.expiryDate?.getTime() ?? null,
  }));

  return { ...ing, stock };
}

/** Best-effort cost of what was actually deducted, snapshotted onto the log. */
function snapshotCost(
  deductions: CookDeduction[],
  mode: PriceMode,
  windowMonths: number,
  now: Date,
): number | null {
  if (deductions.length === 0) return null;
  const ids = [...new Set(deductions.map((d) => d.ingredientId))];
  const priceByIng = listPriceEntriesFor(ids);
  const ingById = new Map(
    db
      .select({ id: ingredients.id, defaultUnit: ingredients.defaultUnit, density: ingredients.density, gramsPerEach: ingredients.gramsPerEach })
      .from(ingredients)
      .where(inArray(ingredients.id, ids))
      .all()
      .map((r) => [r.id, r] as const),
  );

  let total = 0;
  let priced = false;
  for (const d of deductions) {
    const ing = ingById.get(d.ingredientId);
    if (!ing?.defaultUnit) continue;
    const up = unitPrice(priceByIng.get(d.ingredientId) ?? [], { defaultUnit: ing.defaultUnit, density: ing.density, gramsPerEach: ing.gramsPerEach }, mode, windowMonths, now);
    if (up == null) continue;
    try {
      total += convert(d.amount, d.unit, ing.defaultUnit, ing.density ?? undefined, ing.gramsPerEach ?? undefined) * up;
      priced = true;
    } catch {
      /* unconvertible to default unit → exclude from cost */
    }
  }
  return priced ? total : null;
}

export type CookResult = { ok: true; cookLogId: number; plan: CookPlan } | { ok: false; error: string };

/** An in-view ingredient swap sent from the client to apply before deducting. */
export type CookSubstitution = {
  rowId: number; // recipe_ingredients row being replaced
  ingredientId: number; // the substitute ingredient
  amount: number | null;
  unit: string | null;
};

/**
 * Resolve client-supplied swaps into full substitutions: the substitute's
 * conversion factors, staple flag, and inventory come from the DB (the client
 * only chooses the ingredient/amount/unit), and the replaced line's `optional`
 * is carried through. Stale rows/unknown ingredients are dropped.
 */
function resolveSubstitutions(
  ingredients: (CookIngredientInput & { rowId: number })[],
  subs: CookSubstitution[],
): ResolvedSubstitution[] {
  const rowById = new Map(ingredients.map((ing) => [ing.rowId, ing]));
  const resolved: ResolvedSubstitution[] = [];
  for (const sub of subs) {
    const original = rowById.get(sub.rowId);
    if (!original) continue; // stale row — ignore
    const info = getSubstituteInfo(sub.ingredientId);
    if (!info) continue;
    resolved.push({
      rowId: sub.rowId,
      ingredient: {
        ingredientId: info.id,
        name: info.name,
        amount: sub.amount,
        unit: sub.unit,
        optional: original.optional,
        isStaple: info.isStaple,
        density: info.density,
        gramsPerEach: info.gramsPerEach,
      },
      stock: info.stock,
    });
  }
  return resolved;
}

const EPS = 1e-9;

/**
 * Record a cook: deduct stock (FIFO-by-expiry; a row emptied to zero is removed),
 * snapshot the cost, and write a CookLog with per-line detail. All inside one
 * transaction (§3.6). In-view substitutions, when supplied, are applied first so
 * the deduction pulls from the swapped ingredients (and their inventory).
 */
export function cookThisRecipe(
  recipeId: number,
  servingsMade: number,
  subs: CookSubstitution[] = [],
): CookResult {
  const data = getCookData(recipeId);
  if (!data) return { ok: false, error: "Recipe not found" };

  const factor = data.recipe.baseServings > 0 ? servingsMade / data.recipe.baseServings : 1;
  const baseStock = new Map(data.stock.map((s) => [s.ingredientId, s.rows]));
  const resolved = resolveSubstitutions(data.ingredients, subs);
  const { ingredients: effIngredients, stockByIngredient: stockByIng } = applySubstitutions(
    data.ingredients,
    baseStock,
    resolved,
  );
  const plan = planCook(effIngredients, stockByIng, factor);

  const settings = getSettings();
  const now = new Date();
  const totalCost = snapshotCost(
    plan.deductions,
    settings.priceMode === "current" ? "current" : "average",
    settings.averageWindowMonths,
    now,
  );

  const cookLogId = db.transaction((tx) => {
    for (const d of plan.deductions) {
      const row = tx
        .select({ quantity: inventoryItems.quantity, publicId: inventoryItems.publicId })
        .from(inventoryItems)
        .where(eq(inventoryItems.id, d.inventoryItemId))
        .get();
      if (!row) continue;
      const remaining = row.quantity - d.amount;
      // Remove a row drained to empty. Use a relative floor as well as the
      // absolute EPS so conversion round-off (~1e-7 of the quantity) doesn't
      // leave a display-"0" residue behind instead of deleting the row.
      if (remaining <= EPS || remaining <= row.quantity * 1e-6) {
        tx.delete(inventoryItems).where(eq(inventoryItems.id, d.inventoryItemId)).run();
        recordTombstone(tx, "inventory_item", row.publicId);
      } else {
        tx.update(inventoryItems)
          .set({ quantity: remaining, updatedAt: now })
          .where(eq(inventoryItems.id, d.inventoryItemId))
          .run();
      }
    }

    const log = tx
      .insert(cookLogs)
      .values({ recipeId, recipeName: data.recipe.name, servingsMade, totalCost, cookedAt: now })
      .returning({ id: cookLogs.id })
      .get();

    if (plan.deductions.length > 0) {
      tx.insert(cookLogLines)
        .values(
          plan.deductions.map((d) => ({
            cookLogId: log.id,
            inventoryItemId: d.inventoryItemId,
            ingredientId: d.ingredientId,
            amountDeducted: d.amount,
            unit: d.unit,
          })),
        )
        .run();
    }
    return log.id;
  });

  return { ok: true, cookLogId, plan };
}

/** Undo a cook: add the deducted amounts back to their exact rows, drop the log. */
export function undoCook(cookLogId: number): { ok: boolean } {
  db.transaction((tx) => {
    const lines = tx.select().from(cookLogLines).where(eq(cookLogLines.cookLogId, cookLogId)).all();
    for (const line of lines) {
      if (line.inventoryItemId == null) continue;
      const exists = tx
        .select({ id: inventoryItems.id })
        .from(inventoryItems)
        .where(eq(inventoryItems.id, line.inventoryItemId))
        .get();
      if (exists) {
        tx.update(inventoryItems)
          .set({ quantity: sql`${inventoryItems.quantity} + ${line.amountDeducted}`, updatedAt: new Date() })
          .where(eq(inventoryItems.id, line.inventoryItemId))
          .run();
      } else {
        // Row was fully consumed and deleted by the cook — recreate it. Original
        // location/expiry/opened/notes aren't on the log line, so they're lost.
        tx.insert(inventoryItems)
          .values({
            ingredientId: line.ingredientId,
            quantity: line.amountDeducted,
            unit: line.unit,
          })
          .run();
      }
    }
    const log = tx
      .select({ publicId: cookLogs.publicId })
      .from(cookLogs)
      .where(eq(cookLogs.id, cookLogId))
      .get();
    tx.delete(cookLogs).where(eq(cookLogs.id, cookLogId)).run(); // cascades lines
    if (log) recordTombstone(tx, "cook_log", log.publicId);
  });
  return { ok: true };
}

// ---- history ----------------------------------------------------------------
export function listCookLogsForRecipe(recipeId: number, limit = 10): CookLog[] {
  return db
    .select()
    .from(cookLogs)
    .where(eq(cookLogs.recipeId, recipeId))
    .orderBy(desc(cookLogs.cookedAt))
    .limit(limit)
    .all();
}

export function cookStats(recipeId: number): { lastCookedAt: Date | null; timesCooked: number } {
  const row = db
    .select({
      last: sql<number | null>`max(${cookLogs.cookedAt})`,
      n: sql<number>`count(*)`,
    })
    .from(cookLogs)
    .where(eq(cookLogs.recipeId, recipeId))
    .get();
  return {
    lastCookedAt: row?.last != null ? new Date(row.last * 1000) : null,
    timesCooked: row?.n ?? 0,
  };
}

export function lastCookedByRecipe(recipeIds: number[]): Map<number, Date> {
  const map = new Map<number, Date>();
  if (recipeIds.length === 0) return map;
  const rows = db
    .select({ recipeId: cookLogs.recipeId, last: sql<number>`max(${cookLogs.cookedAt})` })
    .from(cookLogs)
    .where(and(inArray(cookLogs.recipeId, recipeIds), sql`${cookLogs.recipeId} is not null`))
    .groupBy(cookLogs.recipeId)
    .all();
  for (const r of rows) {
    if (r.recipeId != null && r.last != null) map.set(r.recipeId, new Date(r.last * 1000));
  }
  return map;
}

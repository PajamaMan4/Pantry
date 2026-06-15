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
import {
  planCook,
  type CookIngredientInput,
  type CookStockRow,
  type CookPlan,
  type CookDeduction,
} from "../domain/cook";
import { unitPrice, type PriceMode } from "../domain/cost";
import { convert } from "../domain/units";

export type CookData = {
  recipe: { id: number; name: string; baseServings: number };
  ingredients: CookIngredientInput[];
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

  const cookIngredients: CookIngredientInput[] = rows.map(({ ri, ing }) => ({
    ingredientId: ing.id,
    name: ing.name,
    amount: ri.amount,
    unit: ri.unit,
    optional: ri.optional,
    isStaple: ing.isStaple,
    density: ing.density,
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
      .select({ id: ingredients.id, defaultUnit: ingredients.defaultUnit, density: ingredients.density })
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
    const up = unitPrice(priceByIng.get(d.ingredientId) ?? [], { defaultUnit: ing.defaultUnit, density: ing.density }, mode, windowMonths, now);
    if (up == null) continue;
    try {
      total += convert(d.amount, d.unit, ing.defaultUnit, ing.density ?? undefined) * up;
      priced = true;
    } catch {
      /* unconvertible to default unit → exclude from cost */
    }
  }
  return priced ? total : null;
}

export type CookResult = { ok: true; cookLogId: number; plan: CookPlan } | { ok: false; error: string };

/**
 * Record a cook: deduct stock (FIFO-by-expiry, clamped to 0), snapshot the cost,
 * and write a CookLog with per-line detail. All inside one transaction (§3.6).
 */
export function cookThisRecipe(recipeId: number, servingsMade: number): CookResult {
  const data = getCookData(recipeId);
  if (!data) return { ok: false, error: "Recipe not found" };

  const factor = data.recipe.baseServings > 0 ? servingsMade / data.recipe.baseServings : 1;
  const stockByIng = new Map(data.stock.map((s) => [s.ingredientId, s.rows]));
  const plan = planCook(data.ingredients, stockByIng, factor);

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
      tx.update(inventoryItems)
        .set({ quantity: sql`max(0, ${inventoryItems.quantity} - ${d.amount})`, updatedAt: now })
        .where(eq(inventoryItems.id, d.inventoryItemId))
        .run();
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
      if (!exists) continue; // row was deleted since — can't restore
      tx.update(inventoryItems)
        .set({ quantity: sql`${inventoryItems.quantity} + ${line.amountDeducted}`, updatedAt: new Date() })
        .where(eq(inventoryItems.id, line.inventoryItemId))
        .run();
    }
    tx.delete(cookLogs).where(eq(cookLogs.id, cookLogId)).run(); // cascades lines
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

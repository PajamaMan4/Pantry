import { asc, desc, eq, sql } from "drizzle-orm";
import { db } from "./client";
import {
  shoppingListItems,
  recipeIngredients,
  ingredients,
  inventoryItems,
  type ShoppingListItem,
} from "./schema";
import { createInventoryItem, logPurchase } from "./inventory";
import { recommendRecipes, type InventoryStock } from "../domain/recommend";

export function listShoppingItems(): ShoppingListItem[] {
  return db
    .select()
    .from(shoppingListItems)
    .orderBy(asc(shoppingListItems.checked), desc(shoppingListItems.createdAt))
    .all();
}

export type ShoppingItemInput = {
  ingredientId: number | null;
  name: string;
  quantity: number | null;
  unit: string | null;
  price: number | null;
};

export function addShoppingItem(input: ShoppingItemInput): number {
  return db
    .insert(shoppingListItems)
    .values({
      ingredientId: input.ingredientId,
      name: input.name.trim(),
      quantity: input.quantity,
      unit: input.unit,
      price: input.price,
    })
    .returning({ id: shoppingListItems.id })
    .get().id;
}

export function updateShoppingItem(id: number, input: ShoppingItemInput): void {
  db.update(shoppingListItems)
    .set({
      ingredientId: input.ingredientId,
      name: input.name.trim(),
      quantity: input.quantity,
      unit: input.unit,
      price: input.price,
    })
    .where(eq(shoppingListItems.id, id))
    .run();
}

export function setShoppingChecked(id: number, checked: boolean): void {
  db.update(shoppingListItems).set({ checked }).where(eq(shoppingListItems.id, id)).run();
}

export function deleteShoppingItem(id: number): void {
  db.delete(shoppingListItems).where(eq(shoppingListItems.id, id)).run();
}

export function clearCheckedShoppingItems(): void {
  db.delete(shoppingListItems).where(eq(shoppingListItems.checked, true)).run();
}

/** Add a recipe's currently-missing required ingredients to the list (deduped). */
export function addMissingForRecipe(recipeId: number): number {
  const ri = db
    .select({
      ingredientId: ingredients.id,
      name: ingredients.name,
      amount: recipeIngredients.amount,
      unit: recipeIngredients.unit,
      optional: recipeIngredients.optional,
      isStaple: ingredients.isStaple,
      density: ingredients.density,
    })
    .from(recipeIngredients)
    .innerJoin(ingredients, eq(recipeIngredients.ingredientId, ingredients.id))
    .where(eq(recipeIngredients.recipeId, recipeId))
    .all();
  if (ri.length === 0) return 0;

  const inventory: InventoryStock[] = db
    .select({ ingredientId: inventoryItems.ingredientId, quantity: inventoryItems.quantity, unit: inventoryItems.unit, expiryDate: inventoryItems.expiryDate })
    .from(inventoryItems)
    .all()
    .map((r) => ({ ingredientId: r.ingredientId, quantity: r.quantity, unit: r.unit, expiryMs: r.expiryDate?.getTime() ?? null }));

  const [result] = recommendRecipes(
    [{ id: recipeId, name: "", ingredients: ri.map((r) => ({ ingredientId: r.ingredientId, amount: r.amount, unit: r.unit, optional: r.optional, isStaple: r.isStaple, density: r.density })) }],
    inventory,
    "available",
    new Map(),
    new Date(),
  );
  const missing = new Set(result.missing);

  const existing = new Set(
    db.select({ id: shoppingListItems.ingredientId }).from(shoppingListItems).all().map((r) => r.id).filter((x): x is number => x != null),
  );

  let added = 0;
  for (const r of ri) {
    if (!missing.has(r.ingredientId) || existing.has(r.ingredientId)) continue;
    db.insert(shoppingListItems)
      .values({ ingredientId: r.ingredientId, name: r.name, quantity: r.amount, unit: r.unit })
      .run();
    existing.add(r.ingredientId);
    added += 1;
  }
  return added;
}

/**
 * "Add purchased to inventory": for each checked item with an ingredient +
 * quantity + unit, add stock (and record the price when set), then remove it.
 */
export function receiveCheckedShoppingItems(): { added: number } {
  const checked = db.select().from(shoppingListItems).where(eq(shoppingListItems.checked, true)).all();
  let added = 0;
  // logPurchase / createInventoryItem are each transactional; process item by item.
  for (const item of checked) {
    if (item.ingredientId == null || item.quantity == null || !item.unit) continue;
    if (item.price != null) {
      logPurchase({
        ingredientId: item.ingredientId,
        name: null,
        locationId: null,
        locationName: null,
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
        store: null,
        purchasedAt: new Date(),
        expiryDate: null,
      });
    } else {
      createInventoryItem({
        ingredientId: item.ingredientId,
        name: null,
        locationId: null,
        locationName: null,
        quantity: item.quantity,
        unit: item.unit,
        expiryDate: null,
        openedDate: null,
        notes: null,
      });
    }
    db.delete(shoppingListItems).where(eq(shoppingListItems.id, item.id)).run();
    added += 1;
  }
  return { added };
}

export function shoppingCount(): { total: number; checked: number } {
  const row = db
    .select({ total: sql<number>`count(*)`, checked: sql<number>`sum(case when ${shoppingListItems.checked} then 1 else 0 end)` })
    .from(shoppingListItems)
    .get();
  return { total: row?.total ?? 0, checked: row?.checked ?? 0 };
}

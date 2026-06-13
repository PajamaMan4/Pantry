/**
 * Seed the database with starter data (§8 Phase 0, Appendix):
 *   - the single settings row
 *   - storage locations
 *   - sample ingredients with categories / default units / densities
 *   - one fully-structured recipe (ingredients + {qN}-linked steps + tags)
 *   - a little inventory + price history so later phases have something to show
 *
 * Idempotent: safe to run repeatedly. Unique rows use ON CONFLICT DO NOTHING and
 * the recipe / inventory / prices are only inserted when absent.
 *
 * Run with: npm run db:seed
 */
import { nanoid } from "nanoid";
import { eq, sql } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import {
  settings,
  storageLocations,
  ingredients,
  recipes,
  recipeIngredients,
  tags,
  recipeTags,
  inventoryItems,
  priceEntries,
  type Step,
} from "../src/lib/db/schema";

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

// ---- ingredient seed table ---------------------------------------------------
type IngredientSeed = {
  name: string;
  category: string;
  defaultUnit: string;
  density?: number;
  isStaple?: boolean;
};

const INGREDIENTS: IngredientSeed[] = [
  { name: "All-purpose flour", category: "pantry", defaultUnit: "g", density: 0.53 },
  { name: "Granulated sugar", category: "pantry", defaultUnit: "g", density: 0.85 },
  { name: "Baking powder", category: "pantry", defaultUnit: "g" },
  { name: "Salt", category: "spice", defaultUnit: "g", isStaple: true },
  { name: "Milk", category: "dairy", defaultUnit: "ml", density: 1.03 },
  { name: "Egg", category: "dairy", defaultUnit: "each" },
  { name: "Butter", category: "dairy", defaultUnit: "g", density: 0.96 },
  { name: "Vanilla extract", category: "pantry", defaultUnit: "ml" },
  { name: "Vegetable oil", category: "pantry", defaultUnit: "ml", density: 0.92 },
  { name: "Honey", category: "pantry", defaultUnit: "g", density: 1.42 },
  { name: "Water", category: "pantry", defaultUnit: "ml", density: 1.0, isStaple: true },
];

const LOCATIONS = ["Fridge", "Freezer", "Pantry", "Spice Rack", "Counter"];

function seed() {
  db.transaction((tx) => {
    // 1) settings — single row (id = 1).
    tx.insert(settings).values({ id: 1 }).onConflictDoNothing().run();

    // 2) storage locations.
    tx.insert(storageLocations)
      .values(LOCATIONS.map((name, i) => ({ name, sortOrder: i })))
      .onConflictDoNothing()
      .run();

    // 3) ingredients.
    tx.insert(ingredients)
      .values(
        INGREDIENTS.map((i) => ({
          name: i.name,
          category: i.category,
          defaultUnit: i.defaultUnit,
          density: i.density ?? null,
          isStaple: i.isStaple ?? false,
        })),
      )
      .onConflictDoNothing()
      .run();

    // Resolve ingredient name -> id for linking.
    const ingRows = tx.select({ id: ingredients.id, name: ingredients.name }).from(ingredients).all();
    const ingId = new Map(ingRows.map((r) => [r.name, r.id] as const));
    const id = (name: string): number => {
      const v = ingId.get(name);
      if (v == null) throw new Error(`Seed: ingredient not found: ${name}`);
      return v;
    };

    // 4) one fully-structured recipe — only if it doesn't already exist.
    const RECIPE_NAME = "Classic Pancakes";
    const existing = tx
      .select({ id: recipes.id })
      .from(recipes)
      .where(eq(recipes.name, RECIPE_NAME))
      .get();

    if (!existing) {
      // Steps use {qN} placeholders linked to master ingredients. Note that the
      // oven temp (350°F) and times (2 minutes) in step 4 are plain prose, NOT
      // placeholders, so the scaler (§5.1) never touches them.
      const steps: Step[] = [
        {
          id: nanoid(),
          text: "In a large bowl, whisk together the {q1} flour, {q2} sugar, {q3} baking powder, and {q4} salt.",
          quantities: {
            q1: { ingredientId: id("All-purpose flour"), amount: 2, unit: "cup" },
            q2: { ingredientId: id("Granulated sugar"), amount: 2, unit: "tbsp" },
            q3: { ingredientId: id("Baking powder"), amount: 2, unit: "tsp" },
            q4: { ingredientId: id("Salt"), amount: 0.5, unit: "tsp" },
          },
        },
        {
          id: nanoid(),
          text: "In another bowl, beat the {q1} eggs, then whisk in {q2} milk, {q3} melted butter, and {q4} vanilla.",
          quantities: {
            q1: { ingredientId: id("Egg"), amount: 2, unit: "each" },
            q2: { ingredientId: id("Milk"), amount: 1.75, unit: "cup" },
            q3: { ingredientId: id("Butter"), amount: 3, unit: "tbsp" },
            q4: { ingredientId: id("Vanilla extract"), amount: 1, unit: "tsp" },
          },
        },
        {
          id: nanoid(),
          text: "Pour the wet ingredients into the dry and stir until just combined; a few lumps are fine.",
        },
        {
          id: nanoid(),
          text: "Heat a lightly oiled griddle over medium heat (about 350°F). Pour {q1} batter per pancake and cook until bubbles form on top, then flip and cook until golden — about 2 minutes per side.",
          quantities: {
            q1: { ingredientId: null, amount: 0.25, unit: "cup" },
          },
        },
      ];

      const recipe = tx
        .insert(recipes)
        .values({
          name: RECIPE_NAME,
          description: "Fluffy, everyday buttermilk-style pancakes. A good test of scaling and unit conversion.",
          steps,
          prepTimeMin: 10,
          cookTimeMin: 15,
          baseServings: 4,
          notes: "Rest the batter 5 minutes for fluffier pancakes.",
          isFavorite: true,
        })
        .returning({ id: recipes.id })
        .get();

      const recipeId = recipe.id;

      // Recipe ingredients (units intentionally differ from default units to
      // exercise conversion later).
      tx.insert(recipeIngredients).values([
        { recipeId, ingredientId: id("All-purpose flour"), amount: 2, unit: "cup", displayOrder: 0 },
        { recipeId, ingredientId: id("Granulated sugar"), amount: 2, unit: "tbsp", displayOrder: 1 },
        { recipeId, ingredientId: id("Baking powder"), amount: 2, unit: "tsp", displayOrder: 2 },
        { recipeId, ingredientId: id("Salt"), amount: 0.5, unit: "tsp", displayOrder: 3 },
        { recipeId, ingredientId: id("Egg"), amount: 2, unit: "each", displayOrder: 4 },
        { recipeId, ingredientId: id("Milk"), amount: 1.75, unit: "cup", displayOrder: 5 },
        { recipeId, ingredientId: id("Butter"), amount: 3, unit: "tbsp", prep: "melted", displayOrder: 6 },
        { recipeId, ingredientId: id("Vanilla extract"), amount: 1, unit: "tsp", optional: true, displayOrder: 7 },
      ]).run();

      // Tags.
      const TAGS = ["breakfast", "quick", "vegetarian"];
      tx.insert(tags).values(TAGS.map((name) => ({ name }))).onConflictDoNothing().run();
      const tagRows = tx.select({ id: tags.id, name: tags.name }).from(tags).all();
      const tagId = new Map(tagRows.map((r) => [r.name, r.id] as const));
      tx.insert(recipeTags)
        .values(TAGS.map((t) => ({ recipeId, tagId: tagId.get(t)! })))
        .onConflictDoNothing()
        .run();
    }

    // 5) a little inventory + price history (only if those tables are empty).
    const invCount = tx.select({ n: sql<number>`count(*)` }).from(inventoryItems).get();
    if ((invCount?.n ?? 0) === 0) {
      const locRows = tx.select({ id: storageLocations.id, name: storageLocations.name }).from(storageLocations).all();
      const locId = new Map(locRows.map((r) => [r.name, r.id] as const));

      tx.insert(inventoryItems).values([
        { ingredientId: id("All-purpose flour"), locationId: locId.get("Pantry"), quantity: 1000, unit: "g" },
        { ingredientId: id("Granulated sugar"), locationId: locId.get("Pantry"), quantity: 500, unit: "g" },
        { ingredientId: id("Milk"), locationId: locId.get("Fridge"), quantity: 1, unit: "l", expiryDate: daysAgo(-5) },
        { ingredientId: id("Egg"), locationId: locId.get("Fridge"), quantity: 6, unit: "each", expiryDate: daysAgo(-12) },
        { ingredientId: id("Butter"), locationId: locId.get("Fridge"), quantity: 200, unit: "g" },
      ]).run();
    }

    const priceCount = tx.select({ n: sql<number>`count(*)` }).from(priceEntries).get();
    if ((priceCount?.n ?? 0) === 0) {
      tx.insert(priceEntries).values([
        { ingredientId: id("All-purpose flour"), price: 3.49, quantity: 2, unit: "kg", store: "Local Grocer", purchasedAt: daysAgo(60) },
        { ingredientId: id("All-purpose flour"), price: 3.79, quantity: 2, unit: "kg", store: "Local Grocer", purchasedAt: daysAgo(20) },
        { ingredientId: id("Granulated sugar"), price: 2.99, quantity: 1, unit: "kg", store: "Local Grocer", purchasedAt: daysAgo(45) },
        { ingredientId: id("Milk"), price: 1.59, quantity: 1, unit: "l", store: "Local Grocer", purchasedAt: daysAgo(7) },
        { ingredientId: id("Butter"), price: 4.5, quantity: 454, unit: "g", store: "Local Grocer", purchasedAt: daysAgo(30) },
      ]).run();
    }
  });

  // Report.
  const counts = {
    settings: db.select({ n: sql<number>`count(*)` }).from(settings).get()?.n ?? 0,
    locations: db.select({ n: sql<number>`count(*)` }).from(storageLocations).get()?.n ?? 0,
    ingredients: db.select({ n: sql<number>`count(*)` }).from(ingredients).get()?.n ?? 0,
    recipes: db.select({ n: sql<number>`count(*)` }).from(recipes).get()?.n ?? 0,
    inventory: db.select({ n: sql<number>`count(*)` }).from(inventoryItems).get()?.n ?? 0,
    prices: db.select({ n: sql<number>`count(*)` }).from(priceEntries).get()?.n ?? 0,
  };
  console.log("[seed] Done:", counts);
}

seed();

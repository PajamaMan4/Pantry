// Drizzle schema — see §2.3 of pantry-technical-design.md.
//
// Modeling notes (§2.4):
//  - Recipe steps are a JSON column (always loaded with the recipe, never queried
//    independently). Recipe *ingredients* are a proper table because they join to
//    the Ingredient master for cost/inventory/recommendations.
//  - Inline step quantities are structured ({qN} placeholders + a quantities map),
//    which is what makes safe scaling/conversion possible (§3.2, §5.1).
import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

// ---- Step type embedded as JSON on the recipe (see modeling note 2.4.a) ----
export interface StepQuantity {
  ingredientId: number | null; // link to master ingredient (enables conversion display)
  amount: number;
  amountMax?: number | null;
  unit: string | null; // UnitDef.id
}

export interface Step {
  id: string; // stable within the recipe (nanoid)
  text: string; // may contain {q1}, {q2}... placeholders
  quantities?: Record<string, StepQuantity>; // keyed by placeholder name
}

export const ingredients = sqliteTable("ingredients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  category: text("category"), // 'produce' | 'dairy' | 'meat' | 'pantry' | 'spice' | ...
  defaultUnit: text("default_unit"), // canonical unit used when normalizing prices/inventory
  density: real("density"), // grams per millilitre; optional, enables volume<->weight
  isStaple: integer("is_staple", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const recipes = sqliteTable("recipes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  steps: text("steps", { mode: "json" }).$type<Step[]>().notNull().default([]),
  prepTimeMin: integer("prep_time_min"), // totalTime is derived = prep + cook
  cookTimeMin: integer("cook_time_min"),
  baseServings: real("base_servings").notNull().default(1),
  notes: text("notes"),
  isFavorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const recipeIngredients = sqliteTable(
  "recipe_ingredients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    ingredientId: integer("ingredient_id")
      .notNull()
      .references(() => ingredients.id),
    amount: real("amount"), // null => non-numeric (raw holds "to taste")
    amountMax: real("amount_max"), // ranges
    unit: text("unit"), // UnitDef.id, or null for counts
    raw: text("raw"), // non-numeric descriptor
    prep: text("prep"), // "finely diced", optional
    optional: integer("optional", { mode: "boolean" }).notNull().default(false),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => [index("ri_recipe_idx").on(t.recipeId)],
);

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const recipeTags = sqliteTable("recipe_tags", {
  recipeId: integer("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" }),
  tagId: integer("tag_id")
    .notNull()
    .references(() => tags.id, { onDelete: "cascade" }),
});

export const storageLocations = sqliteTable("storage_locations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(), // 'Fridge', 'Freezer', 'Pantry', ...
  sortOrder: integer("sort_order").notNull().default(0),
});

export const inventoryItems = sqliteTable(
  "inventory_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ingredientId: integer("ingredient_id")
      .notNull()
      .references(() => ingredients.id),
    locationId: integer("location_id").references(() => storageLocations.id),
    quantity: real("quantity").notNull(),
    unit: text("unit").notNull(), // UnitDef.id
    expiryDate: integer("expiry_date", { mode: "timestamp" }),
    openedDate: integer("opened_date", { mode: "timestamp" }),
    notes: text("notes"),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("inv_ing_idx").on(t.ingredientId)],
);

export const priceEntries = sqliteTable(
  "price_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ingredientId: integer("ingredient_id")
      .notNull()
      .references(() => ingredients.id),
    price: real("price").notNull(), // total paid, in the configured currency
    quantity: real("quantity").notNull(), // for THIS much...
    unit: text("unit").notNull(), // ...of THIS unit  -> unit price = price / quantity (then normalized)
    store: text("store"),
    purchasedAt: integer("purchased_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("price_ing_idx").on(t.ingredientId)],
);

export const cookLogs = sqliteTable("cook_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  recipeId: integer("recipe_id").references(() => recipes.id, { onDelete: "set null" }),
  recipeName: text("recipe_name"), // snapshot, survives recipe deletion
  servingsMade: real("servings_made").notNull(),
  totalCost: real("total_cost"), // cost snapshot at time of cooking (nullable)
  cookedAt: integer("cooked_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  notes: text("notes"),
});

export const cookLogLines = sqliteTable("cook_log_lines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cookLogId: integer("cook_log_id")
    .notNull()
    .references(() => cookLogs.id, { onDelete: "cascade" }),
  inventoryItemId: integer("inventory_item_id"), // which item was decremented (nullable if later deleted)
  ingredientId: integer("ingredient_id").notNull(),
  amountDeducted: real("amount_deducted").notNull(),
  unit: text("unit").notNull(),
});

export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey().default(1), // single row
  unitSystem: text("unit_system").notNull().default("imperial"), // 'metric' | 'imperial'
  priceMode: text("price_mode").notNull().default("average"), // 'current' | 'average'
  averageWindowMonths: integer("average_window_months").notNull().default(6), // 3-6
  currency: text("currency").notNull().default("USD"),
  roundingMode: text("rounding_mode").notNull().default("cooking"), // 'cooking' | 'exact'
});

// Convenience inferred types for the rest of the app.
export type Ingredient = typeof ingredients.$inferSelect;
export type NewIngredient = typeof ingredients.$inferInsert;
export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type RecipeIngredient = typeof recipeIngredients.$inferSelect;
export type NewRecipeIngredient = typeof recipeIngredients.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type StorageLocation = typeof storageLocations.$inferSelect;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type NewInventoryItem = typeof inventoryItems.$inferInsert;
export type PriceEntry = typeof priceEntries.$inferSelect;
export type NewPriceEntry = typeof priceEntries.$inferInsert;
export type CookLog = typeof cookLogs.$inferSelect;
export type CookLogLine = typeof cookLogLines.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;

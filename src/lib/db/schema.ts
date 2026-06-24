// Drizzle schema — see §2.3 of pantry-technical-design.md.
//
// Modeling notes (§2.4):
//  - Recipe steps are a JSON column (always loaded with the recipe, never queried
//    independently). Recipe *ingredients* are a proper table because they join to
//    the Ingredient master for cost/inventory/recommendations.
//  - Inline step quantities are structured ({qN} placeholders + a quantities map),
//    which is what makes safe scaling/conversion possible (§3.2, §5.1).
import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { newPublicId } from "./ids";

// `publicId` is a sync-stable, globally-unique id that travels with a row across
// databases (local autoincrement `id` stays for joins). Added to every entity that
// syncs independently; aggregate children (recipe_ingredients, recipe_tags,
// cook_log_lines) and the settings singleton are intentionally excluded. See the
// sync-enabler plan / pantry-mobile-sync-feasibility.md §7.
const publicId = () => text("public_id").notNull().unique().$defaultFn(newPublicId);

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
  publicId: publicId(),
  name: text("name").notNull().unique(),
  category: text("category"), // 'produce' | 'dairy' | 'meat' | 'pantry' | 'spice' | ...
  defaultUnit: text("default_unit"), // canonical unit used when normalizing prices/inventory
  density: real("density"), // grams per millilitre; optional, enables volume<->weight
  gramsPerEach: real("grams_per_each"), // grams per count; optional, enables count<->weight
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
  publicId: publicId(),
  name: text("name").notNull(),
  description: text("description"),
  steps: text("steps", { mode: "json" }).$type<Step[]>().notNull().default([]),
  prepTimeMin: integer("prep_time_min"), // totalTime is derived = prep + cook
  cookTimeMin: integer("cook_time_min"),
  baseServings: real("base_servings").notNull().default(1),
  notes: text("notes"),
  rating: integer("rating"), // 1–5, optional
  isFavorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
  // Optional link to a variant group ("Alfredo Pasta"): recipes sharing a group
  // are variants of one another. null => standalone recipe. set-null on delete so
  // removing a recipe (or its group) never breaks the remaining members (§ variants).
  groupId: integer("group_id").references(() => recipeGroups.id, { onDelete: "set null" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// A named group of variant recipes. The group only collects independent recipes;
// it stores no recipe data itself.
export const recipeGroups = sqliteTable("recipe_groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: publicId(),
  name: text("name").notNull(),
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
    // Optional grouping label for multi-part recipes ("For the crust", ...).
    // null on every row => a flat, unlabeled ingredient list (§2.4). Rows keep
    // their section via displayOrder, so the same ingredient can appear in more
    // than one section.
    sectionTitle: text("section_title"),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => [index("ri_recipe_idx").on(t.recipeId), index("ri_ingredient_idx").on(t.ingredientId)],
);

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: publicId(),
  name: text("name").notNull().unique(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const recipeTags = sqliteTable(
  "recipe_tags",
  {
    recipeId: integer("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [index("rt_recipe_idx").on(t.recipeId), index("rt_tag_idx").on(t.tagId)],
);

export const storageLocations = sqliteTable("storage_locations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: publicId(),
  name: text("name").notNull().unique(), // 'Fridge', 'Freezer', 'Pantry', ...
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const inventoryItems = sqliteTable(
  "inventory_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: publicId(),
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
    publicId: publicId(),
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
  publicId: publicId(),
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
  inventoryView: text("inventory_view").notNull().default("alphabetical"), // 'alphabetical' | 'location'
  anthropicApiKey: text("anthropic_api_key"), // optional, enables Claude recipe import
  // Singleton row (id=1) — no publicId; a future sync LWW-merges it by updatedAt.
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const ingredientAliases = sqliteTable(
  "ingredient_aliases",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    publicId: publicId(),
    ingredientId: integer("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    alias: text("alias").notNull().unique(),
  },
  (t) => [index("alias_ing_idx").on(t.ingredientId)],
);

export const shoppingListItems = sqliteTable("shopping_list_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  publicId: publicId(),
  ingredientId: integer("ingredient_id").references(() => ingredients.id, { onDelete: "set null" }),
  name: text("name").notNull(), // free text or ingredient-name snapshot
  quantity: real("quantity"),
  unit: text("unit"),
  price: real("price"), // optional price paid — records a PriceEntry when received
  checked: integer("checked", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// Deletion log: a hard delete leaves no trace, so a future phone↔PC sync can't tell
// a peer "this row was removed" and the row reappears on the next sync. Each user
// delete records (entity, the row's publicId, when) here. Only entities that carry a
// publicId are tombstoned; aggregate children and the settings singleton are not.
export const tombstones = sqliteTable(
  "tombstones",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    entity: text("entity").notNull(), // 'recipe' | 'ingredient' | 'inventory_item' | ...
    publicId: text("public_id").notNull(), // the deleted row's publicId
    deletedAt: integer("deleted_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => [index("tombstone_entity_idx").on(t.entity, t.publicId)],
);

// Convenience inferred types for the rest of the app.
export type Ingredient = typeof ingredients.$inferSelect;
export type NewIngredient = typeof ingredients.$inferInsert;
export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type RecipeIngredient = typeof recipeIngredients.$inferSelect;
export type NewRecipeIngredient = typeof recipeIngredients.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type RecipeGroup = typeof recipeGroups.$inferSelect;
export type StorageLocation = typeof storageLocations.$inferSelect;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type NewInventoryItem = typeof inventoryItems.$inferInsert;
export type PriceEntry = typeof priceEntries.$inferSelect;
export type NewPriceEntry = typeof priceEntries.$inferInsert;
export type CookLog = typeof cookLogs.$inferSelect;
export type CookLogLine = typeof cookLogLines.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;
export type ShoppingListItem = typeof shoppingListItems.$inferSelect;
export type NewShoppingListItem = typeof shoppingListItems.$inferInsert;
export type IngredientAlias = typeof ingredientAliases.$inferSelect;
export type Tombstone = typeof tombstones.$inferSelect;
export type NewTombstone = typeof tombstones.$inferInsert;

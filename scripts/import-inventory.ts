/**
 * Import inventory from pantry_inventory.csv.
 *
 * Clears existing inventory items, then inserts all CSV rows.
 * Creates any missing ingredients and storage locations on the fly.
 *
 * Run with: npx tsx scripts/import-inventory.ts
 */
import { sql } from "drizzle-orm";
import { db } from "../src/lib/db/client";
import { storageLocations, ingredients, inventoryItems } from "../src/lib/db/schema";

// ---- CSV data ----------------------------------------------------------------

type CsvRow = {
  name: string;
  category: string;
  quantity: string;
  location: string;
  notes?: string;
};

const CSV_DATA: CsvRow[] = [
  { name: "Potatoes", category: "Produce", quantity: "1.5 lb", location: "Refrigerator" },
  { name: "Red Onion", category: "Produce", quantity: "4 each", location: "Refrigerator" },
  { name: "Parmesan Cheese", category: "Dairy", quantity: "1.6 lb", location: "Refrigerator" },
  { name: "Cheddar Cheese", category: "Dairy", quantity: "1 cup", location: "Refrigerator" },
  { name: "Eggs", category: "Dairy", quantity: "21 each", location: "Refrigerator" },
  { name: "Milk", category: "Dairy", quantity: "0.25 gal", location: "Refrigerator" },
  { name: "Lemon Juice", category: "Condiments", quantity: "30 fl oz", location: "Refrigerator" },
  { name: "Ketchup", category: "Condiments", quantity: "19 oz", location: "Refrigerator" },
  { name: "White Wine", category: "Beverages/Alcohol", quantity: "0.5 bottle", location: "Refrigerator" },
  { name: "Red Wine", category: "Beverages/Alcohol", quantity: "0.5 bottle", location: "Refrigerator" },
  { name: "Pickles", category: "Condiments", quantity: "1 pint", location: "Refrigerator" },
  { name: "Sliced Jalapeno Peppers", category: "Condiments", quantity: "1 pint", location: "Refrigerator" },
  { name: "Mayonnaise", category: "Condiments", quantity: "15 fl oz", location: "Refrigerator" },
  { name: "White Mushrooms", category: "Produce", quantity: "8 oz", location: "Refrigerator" },
  { name: "Napa Cabbage", category: "Produce", quantity: "1 head", location: "Refrigerator" },
  { name: "Green Onions", category: "Produce", quantity: "", location: "Refrigerator" },
  { name: "Roma Tomatoes", category: "Produce", quantity: "3 each", location: "Refrigerator" },
  { name: "Bacon", category: "Meat", quantity: "3 slices", location: "Refrigerator" },
  { name: "Garlic", category: "Produce", quantity: "", location: "Refrigerator" },
  { name: "French Fries (Frozen)", category: "Frozen", quantity: "13 oz", location: "Freezer" },
  { name: "Bacon", category: "Meat", quantity: "2 lb", location: "Freezer" },
  { name: "Argentine Shrimp", category: "Seafood", quantity: "6 lb", location: "Freezer" },
  { name: "Ribeye Steak", category: "Meat", quantity: "3 lb", location: "Freezer" },
  { name: "Short Ribs", category: "Meat", quantity: "2 lb", location: "Freezer" },
  { name: "Chicken Breast", category: "Meat", quantity: "2 lb", location: "Freezer" },
  { name: "Chicken Thigh", category: "Meat", quantity: "1 lb", location: "Freezer" },
  { name: "Salmon", category: "Seafood", quantity: "2 lb", location: "Freezer" },
  { name: "Diced Tomatoes (Canned)", category: "Canned Goods", quantity: "411 g", location: "Pantry" },
  { name: "Artichoke Hearts", category: "Canned Goods", quantity: "200 g", location: "Pantry" },
  { name: "Israeli Couscous", category: "Grains/Pasta", quantity: "14 oz", location: "Pantry" },
  { name: "Arborio Rice", category: "Grains/Pasta", quantity: "20 oz", location: "Pantry" },
  { name: "Ramen Noodles", category: "Grains/Pasta", quantity: "9 oz", location: "Pantry" },
  { name: "Cavatappi", category: "Grains/Pasta", quantity: "6 oz", location: "Pantry" },
  { name: "Penne", category: "Grains/Pasta", quantity: "6 oz", location: "Pantry" },
  { name: "Fettuccine", category: "Grains/Pasta", quantity: "6 oz", location: "Pantry" },
  { name: "Spaghetti", category: "Grains/Pasta", quantity: "6 oz", location: "Pantry" },
  { name: "Bread Crumbs (Plain)", category: "Baking", quantity: "5 oz", location: "Pantry" },
  { name: "Quick Grits", category: "Grains", quantity: "12 oz", location: "Pantry" },
  { name: "Apple Cider Vinegar", category: "Oils/Vinegars", quantity: "30 fl oz", location: "Pantry" },
  { name: "Tonkatsu Sauce", category: "Condiments", quantity: "0.5 bottle", location: "Pantry" },
  { name: "Ponzu Sauce", category: "Condiments", quantity: "0.5 bottle", location: "Pantry" },
  { name: "Sherry Vinegar", category: "Oils/Vinegars", quantity: "0.5 bottle", location: "Pantry" },
  { name: "Dark Soy Sauce", category: "Condiments", quantity: "0.5 bottle", location: "Pantry" },
  { name: "Red Wine Vinegar", category: "Oils/Vinegars", quantity: "0.5 bottle", location: "Pantry" },
  { name: "Rice Vinegar", category: "Oils/Vinegars", quantity: "0.5 bottle", location: "Pantry" },
  { name: "Tahini Sauce", category: "Condiments", quantity: "0.5 bottle", location: "Pantry" },
  { name: "Maple Syrup", category: "Condiments", quantity: "0.5 bottle", location: "Pantry" },
  { name: "Mirin", category: "Condiments", quantity: "6 fl oz", location: "Pantry" },
  { name: "Mushroom-Flavored Dark Soy Sauce", category: "Condiments", quantity: "17 fl oz", location: "Pantry" },
  { name: "Flour", category: "Baking", quantity: "5 cup", location: "Lazy Susan" },
  { name: "Flour", category: "Baking", quantity: "5 lb", location: "Lazy Susan" },
  { name: "Baking Soda", category: "Baking", quantity: "10 oz", location: "Lazy Susan" },
  { name: "Brown Sugar", category: "Baking", quantity: "1 lb", location: "Lazy Susan" },
  { name: "Sugar (Granulated)", category: "Baking", quantity: "5 lb", location: "Lazy Susan" },
  { name: "Table Salt", category: "Baking", quantity: "", location: "Lazy Susan" },
  { name: "Kosher Salt", category: "Baking", quantity: "", location: "Lazy Susan" },
  { name: "Baking Cocoa", category: "Baking", quantity: "8 oz", location: "Lazy Susan" },
  { name: "Olive Oil", category: "Oils/Vinegars", quantity: "", location: "Lazy Susan" },
  { name: "Soy Sauce", category: "Condiments", quantity: "8 oz", location: "Lazy Susan" },
  { name: "Paprika", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Onion Powder", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Parsley", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Fennel", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Red Pepper Flakes", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Chili Powder", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Black Pepper", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Sage", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Italian Seasoning", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Oregano", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Basil", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Rosemary", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Thyme", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Garlic Powder", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Cumin", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Cayenne Pepper", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Turmeric", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Nutmeg", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Coriander", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Lemon Pepper", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Cinnamon", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "White Pepper", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Cloves", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Sesame Seed", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Bay Leaf", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Anise Seed", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Cardamom", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Ground Mustard", category: "Spices", quantity: "", location: "Lazy Susan", notes: "Possible duplicate of Mustard" },
  { name: "Caraway Seed", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "Ground Ginger", category: "Spices", quantity: "", location: "Lazy Susan" },
  { name: "MSG", category: "Spices", quantity: "", location: "Lazy Susan" },
];

// ---- Helpers -----------------------------------------------------------------

function parseQuantity(raw: string): { amount: number; unit: string } {
  if (!raw || !raw.trim()) return { amount: 1, unit: "each" };
  const s = raw.trim().replace("+", "");
  const match = s.match(/^([\d.]+)\s*(.+)?$/);
  if (!match) return { amount: 1, unit: "each" };
  const amount = parseFloat(match[1]);
  const unitStr = (match[2] ?? "").trim().toLowerCase();
  switch (unitStr) {
    case "lb":       return { amount, unit: "lb" };
    case "oz":       return { amount, unit: "oz" };
    case "g":        return { amount, unit: "g" };
    case "kg":       return { amount, unit: "kg" };
    case "ml":       return { amount, unit: "ml" };
    case "l":        return { amount, unit: "l" };
    case "cup":
    case "cups":     return { amount, unit: "cup" };
    case "tsp":      return { amount, unit: "tsp" };
    case "tbsp":     return { amount, unit: "tbsp" };
    case "fl oz":    return { amount, unit: "fl_oz" };
    case "each":     return { amount, unit: "each" };
    case "gal":      return { amount: amount * 16, unit: "cup" };  // 1 gal = 16 cups
    case "pint":     return { amount: amount * 16, unit: "fl_oz" }; // 1 pint = 16 fl oz
    default:         return { amount, unit: "each" }; // bottle, head, slices, etc.
  }
}

function mapLocation(loc: string): string {
  return loc === "Refrigerator" ? "Fridge" : loc;
}

const CATEGORY_MAP: Record<string, string> = {
  "Produce":           "produce",
  "Dairy":             "dairy",
  "Condiments":        "condiments",
  "Beverages/Alcohol": "beverages",
  "Frozen":            "frozen",
  "Meat":              "meat",
  "Seafood":           "seafood",
  "Canned Goods":      "canned",
  "Grains/Pasta":      "grains",
  "Baking":            "baking",
  "Grains":            "grains",
  "Oils/Vinegars":     "oils",
  "Spices":            "spice",
};

function mapCategory(cat: string): string {
  return CATEGORY_MAP[cat] ?? cat.toLowerCase();
}

// ---- Import ------------------------------------------------------------------

function importInventory() {
  db.transaction((tx) => {
    // 1) Ensure all needed locations exist.
    const neededLocs = [...new Set(CSV_DATA.map((r) => mapLocation(r.location)))];
    tx.insert(storageLocations)
      .values(neededLocs.map((name, i) => ({ name, sortOrder: 100 + i })))
      .onConflictDoNothing()
      .run();

    // 2) Ensure all needed ingredients exist (one row per unique name).
    const seen = new Set<string>();
    const uniqueRows: CsvRow[] = [];
    for (const row of CSV_DATA) {
      const key = row.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueRows.push(row);
      }
    }
    tx.insert(ingredients)
      .values(
        uniqueRows.map((r) => ({
          name: r.name,
          category: mapCategory(r.category),
          defaultUnit: parseQuantity(r.quantity).unit,
        })),
      )
      .onConflictDoNothing()
      .run();

    // 3) Clear existing inventory so the DB matches the CSV exactly.
    tx.delete(inventoryItems).run();

    // 4) Resolve name → id maps.
    const ingRows = tx.select({ id: ingredients.id, name: ingredients.name }).from(ingredients).all();
    const ingId = new Map(ingRows.map((r) => [r.name.toLowerCase(), r.id]));

    const locRows = tx.select({ id: storageLocations.id, name: storageLocations.name }).from(storageLocations).all();
    const locId = new Map(locRows.map((r) => [r.name.toLowerCase(), r.id]));

    // 5) Insert inventory rows.
    for (const row of CSV_DATA) {
      const { amount, unit } = parseQuantity(row.quantity);
      const iId = ingId.get(row.name.toLowerCase());
      if (iId == null) {
        console.warn(`[import] Ingredient not found after insert: ${row.name}`);
        continue;
      }
      const lId = locId.get(mapLocation(row.location).toLowerCase()) ?? null;
      tx.insert(inventoryItems)
        .values({
          ingredientId: iId,
          locationId: lId,
          quantity: amount,
          unit,
          notes: row.notes ?? null,
        })
        .run();
    }
  });

  const counts = {
    ingredients: db.select({ n: sql<number>`count(*)` }).from(ingredients).get()?.n ?? 0,
    locations:   db.select({ n: sql<number>`count(*)` }).from(storageLocations).get()?.n ?? 0,
    inventory:   db.select({ n: sql<number>`count(*)` }).from(inventoryItems).get()?.n ?? 0,
  };
  console.log("[import] Done:", counts);
}

importInventory();

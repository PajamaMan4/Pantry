// Ad-hoc seed for manual verification of the "I made this -> zero stock" fix.
// Run with PANTRY_DB_PATH pointing at a scratch db. Not part of the app.
import { createRecipe } from "../src/lib/db/recipes";
import { createInventoryItem } from "../src/lib/db/inventory";

const recipeId = createRecipe({
  name: "Verify Zero Stock",
  description: null,
  prepTimeMin: null,
  cookTimeMin: null,
  baseServings: 1,
  notes: null,
  isFavorite: false,
  tags: [],
  groupName: null,
  ingredients: [
    {
      ingredientId: null,
      name: "Verify Flour",
      amount: 2,
      amountMax: null,
      unit: "cup",
      raw: "2 cup Verify Flour",
      prep: null,
      optional: false,
    },
  ],
  steps: [{ text: "Mix it." }],
});

const inventoryItemId = createInventoryItem({
  ingredientId: null,
  name: "Verify Flour",
  locationId: null,
  locationName: null,
  quantity: 2,
  unit: "cup",
  expiryDate: null,
  openedDate: null,
  notes: null,
});

console.log(JSON.stringify({ recipeId, inventoryItemId }));

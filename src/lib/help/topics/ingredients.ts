import type { HelpTopic } from "../types";

export const ingredientTopics: Record<
  | "ingredients"
  | "ingredient-new"
  | "ingredient-detail"
  | "inventory-add"
  | "inventory-edit"
  | "inventory-remove",
  HelpTopic
> = {
  ingredients: {
    id: "ingredients",
    title: "Ingredients & inventory",
    summary: [
      "Ingredients are Pantry's other main pillar — your inventory and your ingredient dictionary both live here.",
      "Switch between the Inventory and Dictionary views near the top, and use the search bar to find an ingredient. The ⋯ menu adds a new ingredient, adds or removes inventory in bulk, and switches display units.",
    ],
    detail: [
      {
        kind: "p",
        text: "The Inventory view shows what you actually have on hand; the Dictionary is every ingredient Pantry knows about, whether or not you currently have any in stock.",
      },
    ],
    href: "/ingredients",
  },
  "ingredient-new": {
    id: "ingredient-new",
    title: "Creating an ingredient",
    summary: [
      "A name is all that's required, but the other fields are what make cost tracking and recipe suggestions accurate.",
    ],
    detail: [
      {
        kind: "fields",
        items: [
          {
            term: "Default unit",
            text: "Used for pricing, and as the default when this ingredient is added to a recipe.",
          },
          {
            term: "Density (g/mL)",
            text: "Converts between mass and volume — useful for something like flour, which you buy by weight but measure by volume.",
          },
          {
            term: "Grams per each (count)",
            text: "Converts between individual items and mass — useful for something like onions, counted in recipes but bought by weight.",
          },
          {
            term: "Alias",
            text: "Alternate names Pantry should recognize as this ingredient (e.g. \"egg\" and \"dozen eggs\").",
          },
          {
            term: "Staple",
            text: "Mark an ingredient you always have — salt, pepper, water — and recipes will always show it as available, skipping inventory tracking for it.",
          },
        ],
      },
      { kind: "p", text: "You can also create an ingredient on the fly while writing a recipe, just by typing its name." },
    ],
    href: "/ingredients/new",
  },
  "ingredient-detail": {
    id: "ingredient-detail",
    title: "An ingredient's page",
    summary: [
      "Everything about one ingredient: current stock, the recipes that use it, aliases, price history, and its details.",
    ],
    detail: [
      { kind: "h", text: "Merging" },
      {
        kind: "p",
        text: "Use \"Merge duplicate\" when two ingredients should have been one — common after importing recipes that call the same thing by different names. Pick the ingredient(s) to merge in, and everything (stock, price history, recipe links) moves onto this one, with the merged name added as an alias.",
      },
      { kind: "h", text: "Price history" },
      {
        kind: "p",
        text: "Add prices manually here, or let them accumulate automatically from the shopping list and the inventory add/edit forms.",
      },
    ],
  },
  "inventory-add": {
    id: "inventory-add",
    title: "Adding inventory",
    summary: [
      "Add several inventory items at once. Each line records stock (amount, unit, location) and/or a price; blank lines are ignored.",
    ],
    detail: [
      {
        kind: "p",
        text: "Type an ingredient name to match an existing one or create a new one on the fly. Amount and unit describe how much you're adding; location is where you're storing it (shown only if storage locations are enabled in Settings).",
      },
    ],
    href: "/ingredients/inventory/add",
  },
  "inventory-edit": {
    id: "inventory-edit",
    title: "Editing inventory",
    summary: [
      "Mass-edit every inventory row at once — quantities, units, and locations — without opening each ingredient individually.",
    ],
    detail: [
      {
        kind: "p",
        text: "There's no back link on this page on purpose: Cancel is the only way out, so you can't lose changes by accidentally navigating away.",
      },
    ],
    href: "/ingredients/inventory/edit",
  },
  "inventory-remove": {
    id: "inventory-remove",
    title: "Removing inventory",
    summary: [
      "Draw down stock you've used up without cooking a logged recipe for it — food that spoiled, or was used outside Pantry.",
    ],
    detail: [
      {
        kind: "p",
        text: "Pick an ingredient, choose which stock entry to remove from (if it's split across locations or purchases), and enter the amount in that entry's own unit. Removing the full amount clears the entry.",
      },
    ],
    href: "/ingredients/inventory/remove",
  },
};

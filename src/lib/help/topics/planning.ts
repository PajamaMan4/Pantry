import type { HelpTopic } from "../types";

export const planningTopics: Record<"home" | "menu" | "make" | "shopping", HelpTopic> = {
  home: {
    id: "home",
    title: "Home page",
    summary: [
      "Your Pantry home page: a snapshot of your Menu, ingredients expiring soon, and recipes you could make right now.",
    ],
    detail: [
      {
        kind: "p",
        text: "The quick links further down jump straight to What can I make?, Recipes, adding a recipe, Ingredients, and Settings.",
      },
    ],
    href: "/",
  },
  menu: {
    id: "menu",
    title: "The Menu",
    summary: [
      "The Menu collects the recipes you plan to make soon. Set the servings you're planning for each, then review the combined ingredients-needed list showing what's in stock and what's short.",
    ],
    detail: [
      {
        kind: "p",
        text: "Push anything missing straight to your shopping list with \"Add missing to list\". Group the ingredient list by category or storage location with the toggle above it.",
      },
    ],
    href: "/menu",
  },
  make: {
    id: "make",
    title: "What can I make?",
    summary: [
      "Suggests recipes you can cook from your current inventory. Staples are assumed on hand, and optional ingredients don't count against a recipe.",
    ],
    detail: [
      {
        kind: "p",
        text: "Sort by Most available, Use soon (prioritizes recipes using ingredients close to expiring), or Cheapest. Add whatever you're missing straight to the shopping list from a recipe's card.",
      },
    ],
    href: "/make",
  },
  shopping: {
    id: "shopping",
    title: "Shopping list",
    summary: [
      "Check items off as you shop and record the price you paid, then move what you bought straight into your inventory.",
    ],
    detail: [
      {
        kind: "p",
        text: "Items land here automatically when you add missing ingredients from a recipe, the Menu, or What can I make?. Group the list by category or storage location with the toggle above it, or bring in a batch of purchases at once with Import.",
      },
    ],
    href: "/shopping",
  },
};

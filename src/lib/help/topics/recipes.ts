import type { HelpBlock, HelpTopic } from "../types";

/** Shared by recipe-new and recipe-edit — same form, same fields. */
const recipeFormFields: HelpBlock[] = [
  {
    kind: "fields",
    items: [
      { term: "Name", text: "The recipe's title. Shown on its card and detail page." },
      { term: "Description", text: "A short blurb. Shown on its card and detail page." },
      { term: "Prep and cook time", text: "Shown on the card and detail page." },
      {
        term: "Servings",
        text: "Used to calculate per-serving cost. Use whatever number feels right to you.",
      },
      { term: "Tags", text: "Keywords used to filter and search. Add as many as you like." },
      {
        term: "Variant group",
        text: "Optional. Groups similar recipes — say, three different alfredo pastas — under one name, so they don't crowd search results as separate entries.",
      },
      {
        term: "Ingredients",
        text: "Name, quantity, unit, and optional notes. Can be split into sections for recipes with multiple components (like a cake with frosting). Add from your inventory or create a new ingredient on the fly.",
      },
      { term: "Steps", text: "Numbered automatically — just add the instructions." },
      { term: "Notes", text: "Anything else worth remembering." },
    ],
  },
  { kind: "h", text: "Linking quantities to steps" },
  {
    kind: "p",
    text: "When a step mentions a quantity and ingredient — \"1 egg\" — Pantry may notice it and show a link icon below the step. Click it to turn the number into a variable that scales along with the rest of the recipe. If it links the wrong ingredient, adjust it manually.",
  },
];

export const recipeTopics: Record<
  "recipes" | "recipe-new" | "recipe-edit" | "recipe-import" | "recipe-detail" | "recipe-cook",
  HelpTopic
> = {
  recipes: {
    id: "recipes",
    title: "Recipes",
    summary: [
      "Recipes are one of Pantry's two main pillars — built to be informative, easy to customize, and easy to share.",
      "Browse, search, and filter your collection here. Use the ⋯ menu to add a new recipe or import one.",
    ],
    detail: [
      { kind: "h", text: "Views" },
      {
        kind: "ul",
        items: [
          "Alphabetical — sorts recipes by title.",
          "Most Available — sorts by how many ingredients you already have, so you see what you're closest to being able to make.",
          "Cheapest — sorts by per-serving cost.",
        ],
      },
      {
        kind: "p",
        text: "Each view can be filtered further: toggle to recipes on your Menu or your favorites, search by name and description, and filter by tags, ingredients, or cooking time.",
      },
      { kind: "h", text: "Recipe cards" },
      {
        kind: "p",
        text: "Each card shows the title, a short description, servings, and per-serving cost. Click a card to open the recipe. The heart icon favorites or unfavorites it; the book icon adds or removes it from your Menu.",
      },
    ],
    href: "/recipes",
  },
  "recipe-new": {
    id: "recipe-new",
    title: "Making a recipe",
    summary: [
      "The new recipe form has a field for every part of a recipe. Fill in what you have — it doesn't need to be perfect the first time, since it's easy to edit later.",
    ],
    detail: recipeFormFields,
  },
  "recipe-edit": {
    id: "recipe-edit",
    title: "Editing a recipe",
    summary: ["The same form used to create a recipe, filled in with its current details."],
    detail: recipeFormFields,
  },
  "recipe-import": {
    id: "recipe-import",
    title: "Importing recipes",
    summary: [
      ".pantry files are JSON exports — the easiest way to share a recipe, or to convert one from a photo or link using an AI web client.",
      "If you've added an Anthropic API key in Settings, you can also paste raw text or a URL directly on this page and let Claude structure a draft for you.",
    ],
    detail: [
      { kind: "h", text: ".pantry files" },
      {
        kind: "p",
        text: "Exporting a recipe from Pantry downloads it as a .pantry JSON file; importing it back in (here, or on another Pantry install) recreates it. You can also give the .pantry JSON schema — downloadable from Settings — to an AI agent in a web client and ask it to convert a recipe from a photo or URL into that format.",
      },
      { kind: "h", text: "AI import" },
      {
        kind: "p",
        text: "With an Anthropic API key saved in Settings, paste raw text or a URL here and Claude will structure it into a draft — name, servings, times, ingredients, and steps — for you to review before saving. This is a work in progress and may not work on every site.",
      },
    ],
    href: "/recipes/import",
  },
  "recipe-detail": {
    id: "recipe-detail",
    title: "Cooking from a recipe",
    summary: [
      "The recipe detail page shows everything about a recipe plus the tools to cook it: a servings scaler, ingredient availability, step tracking, and cost.",
    ],
    detail: [
      { kind: "h", text: "Header" },
      {
        kind: "p",
        text: "Title, description, cook times, times cooked, and tags. The heart favorites the recipe; in the upper right, add it to your Menu, toggle Cook Mode (keeps your screen awake), or open the ⋯ menu for Edit, Export, Units, and Delete.",
      },
      { kind: "h", text: "Ingredients" },
      {
        kind: "p",
        text: "A red X means you don't have enough of that ingredient in stock; a green check means you do. No icon means Pantry can't tell. Use the − / + buttons, or type a number directly (decimals like 2.5 work), to scale servings. Substitute swaps one ingredient for another — use it for a one-off swap, not a new variant. To List adds whatever you're short on to your shopping list.",
      },
      { kind: "h", text: "Steps" },
      {
        kind: "p",
        text: "Press a step's number to mark it complete as you go. The \"I made this\" button at the bottom logs the cook and deducts the ingredients from your inventory.",
      },
      { kind: "h", text: "Cost" },
      {
        kind: "p",
        text: "Shows the per-serving total by default; expand it for the breakdown per ingredient. Ingredients with no price or a unit mismatch are left out of the total, so double-check if a cost looks suspiciously low.",
      },
    ],
  },
  "recipe-cook": {
    id: "recipe-cook",
    title: "Cook Mode",
    summary: [
      "Cook Mode steps through a recipe one step at a time, full-screen, and keeps your screen from going to sleep.",
    ],
    detail: [
      {
        kind: "p",
        text: "The Serves stepper and the As written / Imperial / Metric switch scale quantities the same way the recipe detail page does. Move between steps with the arrow buttons or the left/right arrow keys. Exit returns to the recipe.",
      },
    ],
  },
};

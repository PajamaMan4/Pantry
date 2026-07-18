/**
 * Help/onboarding content for Pantry, kept as plain data so it can be rendered
 * by the static guide page (`/settings/guide`) and, later, drive an interactive
 * click-through tour without rewriting the copy. No I/O — pure content.
 */

export type GuideSection = {
  id: string;
  title: string;
  /** Plain prose, 2–4 sentences. */
  body: string;
  /** Deep link to the relevant page, when the section maps to one. */
  href?: string;
  // targetSelector?: string; // reserved for a future interactive tour
};

export const guideSections: GuideSection[] = [
  {
    id: "recipes",
    title: "Recipes",
    body: "The Recipes page lists everything you've saved. Search by name, filter by tag, ingredient, max time, or favorites, and sort alphabetically, by how much you can make right now, or by cost per serving. Each card shows what's in stock and what you're missing.",
    href: "/recipes",
  },
  {
    id: "recipe-detail",
    title: "Cooking from a recipe",
    body: "Open a recipe to check off steps, see its per-serving cost, and log a cook — logging deducts the ingredients you used from your inventory. Use the actions menu to edit, change display units, export, or delete.",
  },
  {
    id: "scaling",
    title: "Scaling & substitutions",
    body: "The \"Serves\" stepper recomputes ingredient amounts and the quantities inside each step on the fly. Scaling is only a view — it never changes the saved recipe. \"Substitute\" swaps an ingredient just for tonight without editing the original.",
  },
  {
    id: "cook-mode",
    title: "Cook mode",
    body: "Turn on Cook mode from a recipe to keep your screen awake while you work, so it won't dim or lock mid-step. There's also a full-screen, one-step-at-a-time cook view for following along hands-free.",
  },
  {
    id: "recipe-import",
    title: "Importing recipes",
    body: "Add recipes by hand, load a .pantry file exported from Pantry, or paste raw recipe text and let Claude structure it into a draft you can review. AI import needs an Anthropic API key set in Settings — without one, enter recipes manually.",
    href: "/recipes/import",
  },
  {
    id: "ingredients",
    title: "Ingredients & inventory",
    body: "Ingredients is both your catalog and your inventory. View it alphabetically or grouped by storage location, and track how much you have on hand along with expiry dates, opened dates, and prices. Use the add form to enter stock and prices for several items at once.",
    href: "/ingredients",
  },
  {
    id: "menu",
    title: "The Menu",
    body: "The Menu collects the recipes you plan to make soon. Set the servings you're planning for each, then review the combined \"ingredients needed\" list showing what's in stock and what's short, and push the missing items to your shopping list.",
    href: "/menu",
  },
  {
    id: "make",
    title: "What can I make?",
    body: "\"What can I make?\" suggests recipes you can cook from your current inventory. Staples are assumed on hand and optional ingredients don't count against a recipe. Sort by most available, what's expiring soonest, or cheapest, and add anything you're missing to the shopping list.",
    href: "/make",
  },
  {
    id: "shopping",
    title: "Shopping list",
    body: "Check items off as you shop and record the price you paid, then move what you bought straight into your inventory. Items also land here automatically when you add missing ingredients from a recipe, the menu, or \"What can I make?\".",
    href: "/shopping",
  },
  {
    id: "settings",
    title: "Settings",
    body: "Settings controls app-wide preferences: unit system, price mode and averaging window, rounding, and currency. It's also where you manage storage locations and save the Anthropic API key that enables AI recipe import.",
    href: "/settings",
  },
  {
    id: "data-backups",
    title: "Data & backups",
    body: "Everything stays on this machine. Export a single-file database snapshot, create backups, or restore from a backup or an uploaded file — a safety backup is taken automatically before anything is overwritten.",
    href: "/data",
  },
];

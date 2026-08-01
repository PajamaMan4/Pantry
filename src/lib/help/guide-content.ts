/**
 * Help/onboarding content for Pantry, kept as plain data so it can be rendered
 * by the static guide page (`/settings/guide`) and, later, drive an interactive
 * click-through tour without rewriting the copy. No I/O — pure content.
 */

export type GuideSection = {
  id: string;
  title: string;
  /** One or more paragraphs of plain prose; each entry renders as its own <p>. */
  body: string[];
  /** Deep link to the relevant page, when the section maps to one. */
  href?: string;
  // targetSelector?: string; // reserved for a future interactive tour
};

export const guideSections: GuideSection[] = [
   {
    id: "home-page",
    title: "Home Page",
    body: [
      "Your Pantry home page. By default, this page will show you a snapshot of your current Menu and some recipes you could make right now. This page is customizable in the settings(feature to add?).",
    ],
    href: "/",
  },
  {
    id: "recipes",
    title: "Recipes",
    body: [
      "Recipes are the first main pillar of the Pantry app. They've been designed to be informative, easily customizable, and shareable.",
      "On the main recipes page, you can view all your recipes as well as filter and sort them in a variety of ways. At the top you can switch between 3 main views. Alphabetical does what you'd expect: sorts your recipes by the alphabetical order of their titles. Most Available sorts your recipes by how many ingredients you already have in your inventory, in other words, which recipes are you closest to being able to make now. Cheapest sorts the recipes by their per-serving cost. Each of these views can be further filtered. You can toggle to see recipes currently on your Menu as well as recipes you've favorited with a heart. You can also search for recipes by name and description and filter by tags, ingredients, and cooking time.",
      "Below the search section, you'll find a list of your recipes. Each recipe card shows the title, a short description, the number of servings, and the per-serving cost. You can click on a recipe to view its details, edit it, or delete it. You can also click the heart icon to favorite/unfavorite a recipe, and the book icon to add or remove the recipe from your Menu.",
      "To make a new recipe, click the triple dots in the top right corner and select 'Add Recipe'. You can also import recipes from a .pantry file or paste raw recipe text to have Claude structure it into a draft for you to review. ",
    ],
    href: "/recipes",
  },
  {
    id: "recipe-editing",
    title: "Making a recipe",
    body: [
      "Clicking the 'New Recipe' button opens the new recipe form. This form has a variety of fields to add all the details for your recipe.",
      "Name: This is the title of your recipe. It will be displayed on the recipe card and in the recipe details view.",
      "Description: This is a short description of your recipe. It will be displayed on the recipe card and in the recipe details view.",
      "Prep and Cook Time: This is the total time it takes to prepare and cook your recipe. It will be displayed on the recipe card and in the recipe details view.",
      "Servings: This is the number of servings your recipe makes. It will be used to calculate the per-serving cost of your recipe. Use whatever feels right to you.",
      "Tags: These are keywords that describe your recipe. They will be used to filter and search for recipes. You can add as many tags as you want.",
      "Variant Group: This is an optional, more advanced feature which allows you to group similar but distinct recipes together, so that when searching through your recipe book, instead of seeing every individual variant you see the variant group. For example, you might have a recipe for a true Italian alfredo pasta, an Americanzied chicken alfredo, and your special steak and mushroom alfredo. You can make a variant group for 'Alfredo Pastas' and when you search your recipe book for pasta recipes, instead of the alfredo recipes hogging the screen, you'll see the group.",
      "Ingredients: This is where you add the ingredients for your recipe. Ingredients can be optionally split into sections, which is useful for recipes with multiple components (like a cake with frosting). Each ingredient has a name, quantity, unit, and optional notes. You can also add ingredients from your inventory or create new ones on the fly.",
      "Steps: This is where you add the steps for your recipe. Each step is automatically numbered and you simply add text instructions for that step. There is also an advanced feature in the steps. When adding a quantity and ingredient to a step, for example '1 egg', the app will notice you referencing an ingredient quantity which you may want to scale if you were to change the number of servings. You'll notice this by a link icon appearing below the step. By clicking the link icon, it automatically replaces the number with a variable which will scale when you scale your recipe later. If the app fails to properly identify the ingredient to be linked, you can manually adjust it.",
      "Notes: This is where you can add any optional notes for your recipe.",
      "After you have filled out the recipe, clicking the 'Create Recipe' button will save the recipe. Don't worry if it isn't perfect the first time; it is really easy to edit a recipe later!"
    ],
  },
  {
    id: "recipe-import",
    title: "Importing recipes",
    body: [
      "There are several options for importing recipes instead of manually creating them. The two main paths are using a .pantry JSON file, or using an AI API key and raw text or a URL to get an AI to create the recipe for you.",
      ".pantry files are simply JSON files in a specific format. When you export a recipe from the app, it will export in this format, making sharing recipes with others as easy as a couple clicks. You can also download the .pantry JSON schema to provide to an AI agent in a web client and ask the AI to convert your favorite recipe from a photo or URL to the .pantry format and import it that way. Free and easy.",
      "For additional convenience, you can also connect to the AI agent of your choice (currently only Claude is supported) by providing your API key in the app's settings. From there, you can paste raw text or a URL directly on the import page and the AI will attempt to structure it into a draft recipe for you to review. This is a work in progress and may not work for all sites, but it is a great way to quickly get recipes into your app without having to manually enter them."
    ],
    href: "/recipes/import",
  },  
  {
    id: "recipe-detail",
    title: "Cooking from a recipe",
    body: [
      "Clicking on a recipe opens up the recipe detail page. This page shows all the details from your recipe entered when creating the recipe, as well as some additional information and tools",
      "At the top of the page, you'll find the title, description, cook times, times cooked, and tags for the recipe. You will also see the heart icon used to favorite a recipe. In the upper right corner you'll find the button to add the recipe to your Menu, as well as turning on Cook Mode, which simply prevents your screen from going to sleep. The triple dots menu contains the edit button, export button, options to change the units of the recipe, and a button to delete the recipe.",
      "Below the title section you'll find the ingredients section. Next to ingredients you can find a red X to indicate if you don't have enough of that ingredient in your inventory, or a green check mark if you do. If the app cannot determine, there will be no icon. The ingredient section also includes a servings scaler you can use to either increase or decrease the amount of servings you plan to make. Use the − and + buttons to step one serving at a time, or click the number and type an amount directly — decimals like 2.5 work if you want a half batch. Finally, on the right are two buttons. The substitute button allows you to swap an ingredient in the recipe for something else. Use this for one-off substitutions rather than new varients. The To List button will see which ingredients you are lacking for the recipe and add them to your shopping list.",
      "Below the ingredients section are the Steps for the recipe. Simple enough, they are the steps as entered when creating the recipe. If you need help keeping track where you are, you can mark a step complete by pressing the step number. At the bottom of the steps section is an 'I made this' button. Pressing this button adds it to your recipe history and also deducts the ingredients from your inventory.",
      "Below the steps are the notes and the cost per serving. By default, only the sum is shown, but you can expand the section by clicking and see the cost breakdown per ingredient. Ingredients with either no price or a unit mismatch will not have a price, so doublecheck if the cost seems suspiciously low."
    ],
  },
  {
    id: "ingredients",
    title: "Ingredients & inventory",
    body: [
      "Ingredients are the second main pillar of the app, and you can view them on the ingredients page.The ingredients page stores information about ingredients, both in your inventory as well as in your 'ingredient dictionary'. Near the top you'll find your view selector, allowing you to switch views between your inventory and the ingredient dictionary, and the search bar. In the upper right corner you'll find the drop down menu containing buttons to create new ingredients (i.e. add them to your dictionary), to add/remove multiple inventory items, and to change the displayed units.",
      "You can create a new ingredient using the New Ingredient button on the Ingredients page or when making a new recipe by simply typing it into the recipe. By default a recipe only needs a name, but to get the most out of the app's features, the other fields are needed. Default unit allows you to select what unit of measurement makes the most sense for this ingredient, and this is used to default when adding it to recipes and is the unit used to keep track of costs. Density (g/mL) is a unit which allows for conversions between mass and volume, which is useful for ingredients such as flour which is purchased by weight but measured volumetrically. Grams per each (count) is a similar concept to density but allows for converting between individual items and mass. Useful for ingredients like onions which are counted in recipes by individual items but purchased again by weight. The Alias field allows the app to recognize the same ingredient by different names. For example, some recipes might call for 1 egg, while others may call for a dozen eggs, but both of these are the same ingredient. Finally, in the new ingredient form, is the stable toggle. If there is an ingredient which you don't need to keep track of in your inventory because you always know you'll have some, mark it as a staple and recipes will always show it as available. This is useful for ingredients like salt, pepper, and water.",
      "Once an ingredient has been created, it will have a detailed page in the Ingredients dictionary. On this page you can edit the details you entered as well as view and add additional details. You can add inventory items for this ingredient, this allows the app to know how much you have on hand. You can view the recipes which use this ingredient, great if you have some but don't know what to use it in. You can also add price history manually, although this will also be added if you use the shopping or mass add ingredient features. In the upper right corner there is a drop down menu which contains the buttons to merge or delete the ingredient. The merge button is useful when two ingredients have been created when one should have simply been the alias of the other. This can occur especially when importing recipes as some ingredients go by a variety of names. Click the merge duplicate button, find the ingredients which should be merged into this ingredient, and press merge. Doing so will combine all the information from the other ingredient(s) into the current one and add them as aliases.",
      "On the main ingredients page, in the drop down menu, is the button to add or remove inventory. The add inventory button opens a form which allows you to quickly add multiple inventory items at once. Type in the ingredients, amount, unit, and location",
    ],
    href: "/ingredients",
  },
  {
    id: "menu",
    title: "The Menu",
    body: [
      "The Menu collects the recipes you plan to make soon. Set the servings you're planning for each, then review the combined \"ingredients needed\" list showing what's in stock and what's short, and push the missing items to your shopping list.",
    ],
    href: "/menu",
  },
  {
    id: "make",
    title: "What can I make?",
    body: [
      "\"What can I make?\" suggests recipes you can cook from your current inventory. Staples are assumed on hand and optional ingredients don't count against a recipe. Sort by most available, what's expiring soonest, or cheapest, and add anything you're missing to the shopping list.",
    ],
    href: "/make",
  },
  {
    id: "shopping",
    title: "Shopping list",
    body: [
      "Check items off as you shop and record the price you paid, then move what you bought straight into your inventory. Items also land here automatically when you add missing ingredients from a recipe, the menu, or \"What can I make?\".",
    ],
    href: "/shopping",
  },
  {
    id: "settings",
    title: "Settings",
    body: [
      "Settings controls app-wide preferences: unit system, price mode and averaging window, rounding, currency, and how many recipes the list page shows at a time. It's also where you manage storage locations and save the Anthropic API key that enables AI recipe import.",
    ],
    href: "/settings",
  },
  {
    id: "data-backups",
    title: "Data & backups",
    body: [
      "Everything stays on this machine. Export a single-file database snapshot, create backups, or restore from a backup or an uploaded file — a safety backup is taken automatically before anything is overwritten.",
    ],
    href: "/data",
  },
];

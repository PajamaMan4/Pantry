import type { HelpTopic, HelpTopicId } from "./types";
import { recipeTopics } from "./topics/recipes";
import { ingredientTopics } from "./topics/ingredients";
import { planningTopics } from "./topics/planning";
import { systemTopics } from "./topics/system";

export type { HelpBlock, HelpTopic, HelpTopicId } from "./types";
export { HELP_TOPIC_IDS } from "./types";

export const helpTopics: Record<HelpTopicId, HelpTopic> = {
  ...planningTopics,
  ...recipeTopics,
  ...ingredientTopics,
  ...systemTopics,
};

/**
 * Display order for the `/settings/guide` page — a deliberate teach-the-app
 * walkthrough, not the alphabetical/insertion order of `helpTopics`. Topics
 * with no distinct summary story of their own (recipe-edit repeats recipe-new;
 * recipe-cook and the inventory add/edit/remove forms are reachable from
 * pages already in this list) are left off the guide and are reachable only
 * from their own page's Help dialog.
 */
export const GUIDE_TOPIC_ORDER: HelpTopicId[] = [
  "home",
  "recipes",
  "recipe-new",
  "recipe-import",
  "recipe-detail",
  "ingredients",
  "menu",
  "make",
  "shopping",
  "settings",
  "data-backups",
];

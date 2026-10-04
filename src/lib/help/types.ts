/**
 * Shared types for Pantry's help content. Kept as plain data (no I/O, no
 * markdown parsing) so the same topic can drive two views:
 *  - the trimmed `/settings/guide` page, which renders only `summary`
 *  - the per-page Help dialog (opened from each page's ⋯ menu), which renders
 *    `summary` followed by the full `detail`
 */

export type HelpBlock =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "fields"; items: { term: string; text: string }[] };

export type HelpTopic = {
  id: HelpTopicId;
  title: string;
  /** 1–3 short paragraphs — what the guide page renders. Task-oriented, not exhaustive. */
  summary: string[];
  /** The reference detail. Rendered after `summary` in the page's Help dialog. */
  detail: HelpBlock[];
  /** Deep link used by the guide's "Go to …" affordance. */
  href?: string;
};

export const HELP_TOPIC_IDS = [
  "home",
  "recipes",
  "recipe-new",
  "recipe-edit",
  "recipe-import",
  "recipe-detail",
  "recipe-cook",
  "ingredients",
  "ingredient-new",
  "ingredient-detail",
  "inventory-add",
  "inventory-edit",
  "inventory-remove",
  "menu",
  "make",
  "shopping",
  "settings",
  "data-backups",
] as const;

export type HelpTopicId = (typeof HELP_TOPIC_IDS)[number];

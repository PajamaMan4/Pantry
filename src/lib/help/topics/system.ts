import type { HelpTopic } from "../types";

export const systemTopics: Record<"settings" | "data-backups", HelpTopic> = {
  settings: {
    id: "settings",
    title: "Settings",
    summary: [
      "App-wide preferences: unit system, price mode and averaging window, rounding, currency, and how many recipes the list page shows at a time.",
    ],
    detail: [
      {
        kind: "p",
        text: "This is also where you manage storage locations and save the Anthropic API key that enables AI recipe import.",
      },
    ],
    href: "/settings",
  },
  "data-backups": {
    id: "data-backups",
    title: "Data & backups",
    summary: [
      "Everything in Pantry stays on this machine. Export a single-file database snapshot, create backups, or restore from a backup or an uploaded file.",
    ],
    detail: [
      {
        kind: "p",
        text: "A safety backup is taken automatically before anything gets overwritten, so a restore can always be undone.",
      },
    ],
    href: "/data",
  },
};

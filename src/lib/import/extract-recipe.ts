import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// Fast, cheap extraction task. The skill default is `claude-opus-4-8`; this is a
// simple structured-extraction job, so swap to `claude-haiku-4-5` here if you'd
// rather trade a little accuracy for lower latency/cost.
const MODEL = "claude-opus-4-8";

// The tool whose input schema *is* the structured recipe. We force the model to
// call it (`tool_choice`), so the response is guaranteed to be a tool_use block
// matching this shape — no free-text JSON to scrape or repair.
const SAVE_RECIPE_TOOL: Anthropic.Tool = {
  name: "save_recipe",
  description: "Save the structured recipe parsed from the raw text.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Recipe title." },
      description: {
        type: ["string", "null"],
        description: "One-line summary, or null if none is given.",
      },
      servings: {
        type: ["number", "null"],
        description: "Number of servings/yield the amounts make, or null if unstated.",
      },
      prepMinutes: {
        type: ["integer", "null"],
        description: "Prep time in minutes, or null if unstated.",
      },
      cookMinutes: {
        type: ["integer", "null"],
        description: "Cook time in minutes, or null if unstated.",
      },
      ingredients: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Ingredient name, e.g. 'all-purpose flour'." },
            amount: {
              type: ["number", "null"],
              description: "Numeric amount, or null for 'to taste' etc.",
            },
            amountMax: {
              type: ["number", "null"],
              description: "Upper bound when the amount is a range (e.g. 2-3), else null.",
            },
            unit: {
              type: ["string", "null"],
              description:
                "Unit of measure exactly as written (e.g. 'cup', 'tbsp', 'g', 'cloves'), or null for whole counts.",
            },
            prep: {
              type: ["string", "null"],
              description: "Preparation note, e.g. 'finely chopped', or null.",
            },
            optional: { type: "boolean", description: "True if the ingredient is optional." },
          },
          required: ["name", "amount", "amountMax", "unit", "prep", "optional"],
        },
      },
      steps: {
        type: "array",
        description: "Ordered method steps, one string per step.",
        items: { type: "string" },
      },
    },
    required: ["name", "description", "servings", "prepMinutes", "cookMinutes", "ingredients", "steps"],
  },
};

// Validates the model's tool input before we trust it.
const extractedRecipeSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().nullable(),
  servings: z.number().positive().nullable(),
  prepMinutes: z.number().int().nonnegative().nullable(),
  cookMinutes: z.number().int().nonnegative().nullable(),
  ingredients: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        amount: z.number().finite().nullable(),
        amountMax: z.number().finite().nullable(),
        unit: z.string().trim().min(1).nullable(),
        prep: z.string().trim().min(1).nullable(),
        optional: z.boolean(),
      }),
    )
    .default([]),
  steps: z.array(z.string().trim().min(1)).default([]),
});

export type ExtractedRecipe = z.infer<typeof extractedRecipeSchema>;

export type ExtractResult =
  | { ok: true; recipe: ExtractedRecipe }
  | { ok: false; error: string };

const SYSTEM_PROMPT =
  "You convert pasted recipe text into structured data by calling the save_recipe tool. " +
  "Extract only what the text states — do not invent ingredients, quantities, times, or steps. " +
  "Preserve units exactly as written. Split the method into discrete, ordered steps. " +
  "If a field is not given, use null (or an empty array for ingredients/steps).";

/**
 * Send raw recipe text to Claude and get back a validated structured recipe.
 * Pure I/O wrapper: callers pass the API key (resolved from Settings/env) so this
 * module stays free of DB access and easy to test.
 */
export async function extractRecipe(rawText: string, apiKey: string): Promise<ExtractResult> {
  const text = rawText.trim();
  if (!text) return { ok: false, error: "Paste some recipe text first." };

  const client = new Anthropic({ apiKey, maxRetries: 2 });

  let message: Anthropic.Message;
  try {
    message = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 4096,
        // Simple extraction — keep it fast, and forced tool choice is incompatible
        // with extended/adaptive thinking anyway.
        thinking: { type: "disabled" },
        system: SYSTEM_PROMPT,
        tools: [SAVE_RECIPE_TOOL],
        tool_choice: { type: "tool", name: SAVE_RECIPE_TOOL.name },
        messages: [{ role: "user", content: text }],
      },
      { timeout: 60_000 },
    );
  } catch (err) {
    return { ok: false, error: describeError(err) };
  }

  const toolUse = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === SAVE_RECIPE_TOOL.name,
  );
  if (!toolUse) {
    return { ok: false, error: "Claude didn't return a structured recipe. Try again or enter it manually." };
  }

  const parsed = extractedRecipeSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    return { ok: false, error: "Couldn't read the recipe Claude returned. Try again or enter it manually." };
  }
  return { ok: true, recipe: parsed.data };
}

function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "The Anthropic API key was rejected. Check the key in Settings.";
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return "This API key doesn't have access to the model. Check your Anthropic account.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "Rate limited by Anthropic. Wait a moment and try again.";
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return "The request to Claude timed out. Try again or paste a shorter recipe.";
  }
  if (err instanceof Anthropic.APIError) {
    return `Claude request failed (${err.status ?? "network"}). Try again or enter it manually.`;
  }
  return "Something went wrong contacting Claude. Try again or enter it manually.";
}

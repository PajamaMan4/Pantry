"use client";

import * as React from "react";
import { LinkIcon, UnlinkIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { displayQuantity } from "@/lib/domain/scaling";

export type EditorStepQuantity = {
  ingredientId: number | null;
  amount: number;
  amountMax: number | null;
  unit: string | null;
};
export type EditorStep = {
  id: string;
  text: string;
  quantities: Record<string, EditorStepQuantity>;
};

type Choice = { id: number; name: string };

// Match "<number><measurement-unit>" spans. The unit alternation excludes
// time/temperature words, so "350°F" / "20 minutes" are never detected.
const MEASURE_RE =
  /(\d+\s+\d+\/\d+|\d+\/\d+|[½⅓⅔¼¾⅛⅜⅝⅞]|\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?)\s*(cups?|tbsps?|tablespoons?|tsps?|teaspoons?|fl\s?oz|ml|millilit(?:re|er)s?|l|lit(?:re|er)s?|oz|ounces?|lbs?|pounds?|g|grams?|kg|kilograms?)\b/gi;

const UNIT_WORD: Record<string, string> = {
  cup: "cup", cups: "cup",
  tbsp: "tbsp", tbsps: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
  tsp: "tsp", tsps: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  floz: "fl_oz",
  ml: "ml", milliliter: "ml", millilitre: "ml", milliliters: "ml", millilitres: "ml",
  l: "l", liter: "l", litre: "l", liters: "l", litres: "l",
  oz: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  g: "g", gram: "g", grams: "g",
  kg: "kg", kilogram: "kg", kilograms: "kg",
};

const UNICODE_FRAC: Record<string, number> = {
  "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

function parseLoose(s: string): number | null {
  const t = s.trim();
  if (UNICODE_FRAC[t] != null) return UNICODE_FRAC[t];
  let m = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = t.match(/^(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function unitId(word: string): string | null {
  return UNIT_WORD[word.toLowerCase().replace(/\s+/g, "")] ?? null;
}

type Detected = {
  matchText: string;
  index: number;
  length: number;
  amount: number;
  amountMax: number | null;
  unit: string;
};

function detectSpans(text: string): Detected[] {
  const out: Detected[] = [];
  for (const m of text.matchAll(MEASURE_RE)) {
    const unit = unitId(m[2]);
    if (!unit) continue;
    const parts = m[1].split(/\s*[-–]\s*/);
    const a = parseLoose(parts[0]);
    if (a == null) continue;
    const b = parts[1] != null ? parseLoose(parts[1]) : null;
    out.push({
      matchText: m[0],
      index: m.index,
      length: m[0].length,
      amount: a,
      amountMax: parts.length > 1 ? b : null,
      unit,
    });
  }
  return out;
}

function nextKey(quantities: Record<string, unknown>): string {
  let n = 1;
  while (quantities[`q${n}`] != null) n += 1;
  return `q${n}`;
}

function literal(q: EditorStepQuantity): string {
  return displayQuantity(
    { amount: q.amount, amountMax: q.amountMax, unit: q.unit },
    { factor: 1, system: "original" },
  );
}

export function StepEditor({
  value,
  ingredientChoices,
  onChange,
}: {
  value: EditorStep;
  ingredientChoices: Choice[];
  onChange: (next: EditorStep) => void;
}) {
  const { text, quantities } = value;

  function setText(nextText: string) {
    // Prune quantities whose placeholder no longer appears in the text.
    const pruned: Record<string, EditorStepQuantity> = {};
    for (const [k, q] of Object.entries(quantities)) {
      if (nextText.includes(`{${k}}`)) pruned[k] = q;
    }
    onChange({ ...value, text: nextText, quantities: pruned });
  }

  function link(span: Detected) {
    const key = nextKey(quantities);
    const newText = text.slice(0, span.index) + `{${key}}` + text.slice(span.index + span.length);
    // Auto-suggest an ingredient whose name appears in the step text.
    const lower = newText.toLowerCase();
    const suggestion = ingredientChoices.find((c) =>
      lower.includes(c.name.toLowerCase().replace(/s$/, "")),
    );
    onChange({
      ...value,
      text: newText,
      quantities: {
        ...quantities,
        [key]: {
          ingredientId: suggestion?.id ?? null,
          amount: span.amount,
          amountMax: span.amountMax,
          unit: span.unit,
        },
      },
    });
  }

  function unlink(key: string) {
    const q = quantities[key];
    const newText = text.replaceAll(`{${key}}`, q ? literal(q) : "");
    const rest = { ...quantities };
    delete rest[key];
    onChange({ ...value, text: newText, quantities: rest });
  }

  function setIngredient(key: string, ingredientId: number | null) {
    onChange({
      ...value,
      quantities: { ...quantities, [key]: { ...quantities[key], ingredientId } },
    });
  }

  const detected = detectSpans(text);
  const linkedKeys = Object.keys(quantities).filter((k) => text.includes(`{${k}}`));

  return (
    <div className="flex-1">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Describe this step. Amounts you mention can be linked below."
        rows={2}
      />

      {detected.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Link for scaling:</span>
          {detected.map((span, i) => (
            <button
              key={`${span.index}-${i}`}
              type="button"
              onClick={() => link(span)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs hover:bg-muted"
            >
              <LinkIcon className="size-3" />
              {span.matchText.trim()}
            </button>
          ))}
        </div>
      )}

      {linkedKeys.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {linkedKeys.map((key) => {
            const q = quantities[key];
            return (
              <div key={key} className="flex flex-wrap items-center gap-1.5 text-xs">
                <Badge variant="secondary" className="font-mono">
                  {`{${key}}`} = {literal(q)}
                </Badge>
                <select
                  className="h-7 rounded-md border border-input bg-transparent px-1.5 text-xs"
                  value={q.ingredientId ?? ""}
                  onChange={(e) => setIngredient(key, e.target.value ? Number(e.target.value) : null)}
                  aria-label={`Ingredient for ${key}`}
                >
                  <option value="">(no ingredient)</option>
                  {ingredientChoices.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => unlink(key)}
                  className="inline-flex items-center gap-1 text-muted-foreground hover:text-destructive"
                >
                  <UnlinkIcon className="size-3" /> unlink
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

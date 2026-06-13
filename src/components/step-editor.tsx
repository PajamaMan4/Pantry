"use client";

import * as React from "react";
import { LinkIcon, UnlinkIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { displayQuantity } from "@/lib/domain/scaling";
import { detectSpans, type DetectedSpan, type LinkChoice } from "@/lib/domain/step-linking";

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
  ingredientChoices: LinkChoice[];
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

  function link(span: DetectedSpan) {
    const key = nextKey(quantities);
    const newText =
      text.slice(0, span.replaceStart) + `{${key}}` + text.slice(span.replaceStart + span.replaceLength);
    onChange({
      ...value,
      text: newText,
      quantities: {
        ...quantities,
        [key]: {
          ingredientId: span.ingredientId,
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

  const detected = detectSpans(text, ingredientChoices);
  const linkedKeys = Object.keys(quantities).filter((k) => text.includes(`{${k}}`));

  return (
    <div className="flex-1">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Describe this step. Amounts you mention can be linked below for scaling."
        rows={2}
      />

      {detected.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Link for scaling:</span>
          {detected.map((span, i) => (
            <button
              key={`${span.replaceStart}-${i}`}
              type="button"
              onClick={() => link(span)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs hover:bg-muted"
            >
              <LinkIcon className="size-3" />
              {span.label}
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

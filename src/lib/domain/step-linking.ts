// Detection for the recipe-editor quantity-linking assist (§3.2). Pure + tested.
//
// Two kinds of scalable spans are detected in a step's prose:
//   - measurement: <number><known unit>      e.g. "2 cups"   → replace number+unit
//   - count:       <number> <word>           e.g. "1 egg"    → replace just the number
// Time/temperature numbers ("350°F", "20 minutes") are never detected.

export type LinkChoice = { id: number; name: string };

export type DetectedSpan = {
  label: string; // chip text, e.g. "2 cups" or "1 egg"
  replaceStart: number; // index in text to begin replacing
  replaceLength: number; // chars to replace (number+unit for measures; number only for counts)
  amount: number;
  amountMax: number | null;
  unit: string | null; // "cup", "each", …
  ingredientId: number | null; // auto-suggested ingredient
};

const NUM = String.raw`\d+\s+\d+\/\d+|\d+\/\d+|[½⅓⅔¼¾⅛⅜⅝⅞]|\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?`;

const MEASURE_RE = new RegExp(
  `(${NUM})\\s*(cups?|tbsps?|tablespoons?|tsps?|teaspoons?|fl\\s?oz|ml|millilit(?:re|er)s?|l|lit(?:re|er)s?|oz|ounces?|lbs?|pounds?|g|grams?|kg|kilograms?)\\b`,
  "gi",
);

// <number><gap><word> — the word becomes prose; only the number is linked.
const COUNT_RE = new RegExp(`(${NUM})(\\s+)([A-Za-z][A-Za-z-]*)`, "g");

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

// Words that, when they follow a number, mean it is NOT a scalable count.
const STOP_WORDS = new Set([
  "degree", "degrees", "f", "c", "fahrenheit", "celsius",
  "minute", "minutes", "min", "mins", "hour", "hours", "hr", "hrs",
  "second", "seconds", "sec", "secs",
  "of", "to", "or", "and", "the", "a", "an", "more", "about", "approximately",
  "time", "times", "inch", "inches", "cm", "mm", "percent",
]);

const UNICODE_FRAC: Record<string, number> = {
  "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

function parseOne(s: string): number | null {
  const t = s.trim();
  if (UNICODE_FRAC[t] != null) return UNICODE_FRAC[t];
  let m = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = t.match(/^(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseAmounts(numPart: string): { amount: number; amountMax: number | null } | null {
  const parts = numPart.split(/\s*[-–]\s*/);
  const a = parseOne(parts[0]);
  if (a == null) return null;
  const b = parts[1] != null ? parseOne(parts[1]) : null;
  return { amount: a, amountMax: parts.length > 1 ? b : null };
}

function unitId(word: string): string | null {
  return UNIT_WORD[word.toLowerCase().replace(/\s+/g, "")] ?? null;
}

function singular(s: string): string {
  return s.toLowerCase().replace(/s$/, "");
}

/** Loosely test whether a single word names an ingredient choice. */
function matchChoiceWord(word: string, choices: LinkChoice[]): number | null {
  const w = singular(word);
  for (const c of choices) if (singular(c.name) === w) return c.id;
  return null;
}

/**
 * Find the ingredient whose name lies nearest to `fromIndex`, preferring names
 * that appear AFTER it (an amount's ingredient almost always follows it).
 */
export function nearestIngredient(
  text: string,
  fromIndex: number,
  choices: LinkChoice[],
): number | null {
  const lower = text.toLowerCase();
  let after: { id: number; d: number } | null = null;
  let before: { id: number; d: number } | null = null;

  for (const c of choices) {
    for (const form of new Set([c.name.toLowerCase(), singular(c.name)])) {
      if (form.length < 2) continue;
      const ia = lower.indexOf(form, fromIndex);
      if (ia !== -1 && (!after || ia - fromIndex < after.d)) after = { id: c.id, d: ia - fromIndex };
      const ib = lower.lastIndexOf(form, Math.max(0, fromIndex - 1));
      if (ib !== -1 && ib < fromIndex && (!before || fromIndex - ib < before.d))
        before = { id: c.id, d: fromIndex - ib };
    }
  }
  return (after ?? before)?.id ?? null;
}

export function detectSpans(text: string, choices: LinkChoice[] = []): DetectedSpan[] {
  const spans: DetectedSpan[] = [];
  const measureRanges: Array<[number, number]> = [];

  // 1) measurement spans (number + unit)
  for (const m of text.matchAll(MEASURE_RE)) {
    const unit = unitId(m[2]);
    const amts = parseAmounts(m[1]);
    if (!unit || !amts) continue;
    const start = m.index;
    const end = start + m[0].length;
    measureRanges.push([start, end]);
    spans.push({
      label: m[0].trim(),
      replaceStart: start,
      replaceLength: m[0].length,
      amount: amts.amount,
      amountMax: amts.amountMax,
      unit,
      ingredientId: nearestIngredient(text, end, choices), // prefer the ingredient AFTER the amount
    });
  }

  // 2) count spans (number + non-unit, non-time/temp word)
  for (const m of text.matchAll(COUNT_RE)) {
    const numPart = m[1];
    const word = m[3];
    const start = m.index;
    if (measureRanges.some(([s, e]) => start >= s && start < e)) continue; // inside a measure
    const w = word.toLowerCase();
    if (UNIT_WORD[w] || STOP_WORDS.has(w)) continue;
    const amts = parseAmounts(numPart);
    if (!amts) continue;

    const wordStart = start + numPart.length + m[2].length;
    const ingredientId =
      matchChoiceWord(word, choices) ?? nearestIngredient(text, wordStart, choices);

    spans.push({
      label: `${numPart.trim()} ${word}`,
      replaceStart: start,
      replaceLength: numPart.length, // replace only the number; the word stays as prose
      amount: amts.amount,
      amountMax: amts.amountMax,
      unit: "each",
      ingredientId,
    });
  }

  return spans.sort((a, b) => a.replaceStart - b.replaceStart);
}

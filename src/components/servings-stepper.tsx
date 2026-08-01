"use client";

import * as React from "react";
import { MinusIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/domain/format";

/**
 * −/+ servings stepper with a typable value. The buttons always step by a whole
 * serving; the field accepts any decimal (a half batch is `2.5`). `onChange`
 * receives an already-clamped value, so callers only decide what to do with it.
 *
 * The field is a plain text input rather than `type="number"`: a number input
 * would render spinners that duplicate the ± buttons, change on scroll-wheel,
 * and report "" for in-progress values like "2." — which makes free typing
 * impossible to track. `inputMode="decimal"` still gets the numeric keypad.
 */
export function ServingsStepper({
  value,
  onChange,
  min = 0.25,
  ariaSuffix = "",
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  /** Appended to the aria-labels to disambiguate multiple steppers on a page. */
  ariaSuffix?: string;
}) {
  const [text, setText] = React.useState(() => formatNumber(value));

  // Re-sync the field whenever `value` changes from the outside (the ± buttons,
  // or the scaler's Reset button) — adjusting state during render, per React.
  const [lastValue, setLastValue] = React.useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(formatNumber(value));
  }

  const clamp = (n: number) => Math.max(min, Math.round(n * 100) / 100);
  const step = (delta: number) => onChange(clamp(value + delta));

  /** Apply the typed text, or revert the field if it isn't a usable number. */
  function commit() {
    const n = Number(text.trim());
    if (text.trim() === "" || !Number.isFinite(n)) {
      setText(formatNumber(value));
      return;
    }
    onChange(clamp(n));
    setText(formatNumber(clamp(n)));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      setText(formatNumber(value));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      step(-1);
    }
  }

  return (
    <div className="flex items-center rounded-md border">
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Fewer servings${ariaSuffix}`}
        onClick={() => step(-1)}
        disabled={value <= min}
      >
        <MinusIcon className="size-4" />
      </Button>
      <input
        type="text"
        inputMode="decimal"
        aria-label={`Servings${ariaSuffix}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={onKeyDown}
        className="w-12 border-0 bg-transparent text-center text-sm font-medium tabular-nums outline-none"
      />
      <Button
        variant="ghost"
        size="icon"
        aria-label={`More servings${ariaSuffix}`}
        onClick={() => step(1)}
      >
        <PlusIcon className="size-4" />
      </Button>
    </div>
  );
}

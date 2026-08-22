"use client";

import { useActionState, useState } from "react";
import { saveSettingsAction, type SaveSettingsResult } from "./actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { Settings } from "@/lib/db/schema";
import { PAGE_SIZE_OPTIONS } from "@/lib/domain/pagination";

const UNIT_SYSTEMS = { imperial: "Imperial (cups, oz, °F)", metric: "Metric (ml, g, °C)" };
const PRICE_MODES = { average: "Average over window", current: "Most recent price" };
const ROUNDING_MODES = { cooking: "Cooking (friendly values)", exact: "Exact (precise factors)" };
const WINDOWS = { "3": "3 months", "4": "4 months", "5": "5 months", "6": "6 months" };
// Derived from the domain constant so the two can't drift apart.
const PER_PAGE: Record<string, string> = Object.fromEntries(
  PAGE_SIZE_OPTIONS.map((n) => [String(n), `${n} per page`]),
);

export function SettingsForm({ initial }: { initial: Settings }) {
  const [state, formAction, pending] = useActionState<SaveSettingsResult | null, FormData>(
    saveSettingsAction,
    null,
  );
  // Capture once: Select's defaultValue must not change after mount (Base UI
  // warns otherwise), but `initial` changes when the page revalidates on save.
  const [initialValues] = useState(initial);

  return (
    <form action={formAction} className="space-y-6">
      <Field label="Unit system" htmlFor="unitSystem">
        <Select name="unitSystem" defaultValue={initialValues.unitSystem} items={UNIT_SYSTEMS}>
          <SelectTrigger id="unitSystem" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(UNIT_SYSTEMS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Price mode" htmlFor="priceMode" hint="Which price feeds the cost calculator.">
        <Select name="priceMode" defaultValue={initialValues.priceMode} items={PRICE_MODES}>
          <SelectTrigger id="priceMode" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PRICE_MODES).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field
        label="Average window"
        htmlFor="averageWindowMonths"
        hint="Range/average price is computed over this window."
      >
        <Select
          name="averageWindowMonths"
          defaultValue={String(initialValues.averageWindowMonths)}
          items={WINDOWS}
        >
          <SelectTrigger id="averageWindowMonths" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(WINDOWS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Rounding mode" htmlFor="roundingMode">
        <Select name="roundingMode" defaultValue={initialValues.roundingMode} items={ROUNDING_MODES}>
          <SelectTrigger id="roundingMode" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ROUNDING_MODES).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Currency" htmlFor="currency" hint="ISO code used when formatting money.">
        <Input
          id="currency"
          name="currency"
          defaultValue={initialValues.currency}
          maxLength={8}
          className="w-40 uppercase"
        />
      </Field>

      <Field
        label="Recipes per page"
        htmlFor="recipesPerPage"
        hint="How many recipes the Recipes page shows at once."
      >
        <Select
          name="recipesPerPage"
          defaultValue={String(initialValues.recipesPerPage)}
          items={PER_PAGE}
        >
          <SelectTrigger id="recipesPerPage" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PER_PAGE).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field
        label="Ingredients per page"
        htmlFor="ingredientsPerPage"
        hint="How many ingredients the Dictionary view shows at once."
      >
        <Select
          name="ingredientsPerPage"
          defaultValue={String(initialValues.ingredientsPerPage)}
          items={PER_PAGE}
        >
          <SelectTrigger id="ingredientsPerPage" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PER_PAGE).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field
        label="Show recipe images"
        htmlFor="showRecipeImages"
        hint="Show a recipe's photo as a banner on its detail page. Photos are never shown on cards or lists."
      >
        <Switch
          id="showRecipeImages"
          name="showRecipeImages"
          defaultChecked={initialValues.showRecipeImages}
          value="1"
          uncheckedValue="0"
        />
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        {state?.ok && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved.</span>
        )}
        {state && !state.ok && (
          <span className="text-sm text-destructive">{state.error}</span>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

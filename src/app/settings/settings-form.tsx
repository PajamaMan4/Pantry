"use client";

import { useActionState } from "react";
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
import type { Settings } from "@/lib/db/schema";

const UNIT_SYSTEMS = { imperial: "Imperial (cups, oz, °F)", metric: "Metric (ml, g, °C)" };
const PRICE_MODES = { average: "Average over window", current: "Most recent price" };
const ROUNDING_MODES = { cooking: "Cooking (friendly values)", exact: "Exact (precise factors)" };
const WINDOWS = { "3": "3 months", "4": "4 months", "5": "5 months", "6": "6 months" };

export function SettingsForm({ initial }: { initial: Settings }) {
  const [state, formAction, pending] = useActionState<SaveSettingsResult | null, FormData>(
    saveSettingsAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-6">
      <Field label="Unit system" htmlFor="unitSystem">
        <Select name="unitSystem" defaultValue={initial.unitSystem} items={UNIT_SYSTEMS}>
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
        <Select name="priceMode" defaultValue={initial.priceMode} items={PRICE_MODES}>
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
          defaultValue={String(initial.averageWindowMonths)}
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
        <Select name="roundingMode" defaultValue={initial.roundingMode} items={ROUNDING_MODES}>
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
          defaultValue={initial.currency}
          maxLength={8}
          className="w-40 uppercase"
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

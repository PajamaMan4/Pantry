"use client";

import * as React from "react";
import { toast } from "sonner";
import { IngredientCombobox, type IngredientOption } from "@/components/ingredient-combobox";
import { createIngredientAction } from "@/app/recipes/actions";

export type PickedIngredient = { id: number | null; name: string; defaultUnit: string | null };

/**
 * Ingredient typeahead with create-on-the-fly, used by the inventory + purchase
 * forms. `onType` reports free text (id cleared); `onPick` fires when an existing
 * or newly-created master ingredient is chosen.
 */
export function IngredientPicker({
  initialOptions,
  selectedName,
  placeholder,
  onType,
  onPick,
}: {
  initialOptions: IngredientOption[];
  selectedName: string;
  placeholder?: string;
  onType: (name: string) => void;
  onPick: (picked: PickedIngredient) => void;
}) {
  const [options, setOptions] = React.useState<IngredientOption[]>(initialOptions);

  return (
    <IngredientCombobox
      options={options}
      selectedName={selectedName}
      placeholder={placeholder}
      onType={onType}
      onSelect={(opt) => onPick({ id: opt.id, name: opt.name, defaultUnit: opt.defaultUnit })}
      onCreate={async (name) => {
        const res = await createIngredientAction({ name });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        const opt: IngredientOption = {
          id: res.ingredient.id,
          name: res.ingredient.name,
          defaultUnit: res.ingredient.defaultUnit,
        };
        setOptions((prev) => (prev.some((o) => o.id === opt.id) ? prev : [...prev, opt]));
        onPick({ id: opt.id, name: opt.name, defaultUnit: opt.defaultUnit });
      }}
    />
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { ServingsStepper } from "@/components/servings-stepper";
import { MenuButton } from "@/app/recipes/menu-button";
import { setMenuServingsAction } from "@/app/recipes/actions";

/**
 * One flat row on the Menu: notepad remove toggle, the recipe name (linking to
 * its page), and a servings stepper. Changing the servings persists to the
 * recipe's menuServings (debounced) and revalidates /menu so the aggregated
 * "Ingredients needed" list recomputes with the chosen amounts.
 */
export function MenuRecipeRow({
  id,
  name,
  baseServings,
  menuServings,
}: {
  id: number;
  name: string;
  baseServings: number;
  menuServings: number | null;
}) {
  const [servings, setServings] = React.useState(menuServings ?? baseServings);
  const [, startTransition] = React.useTransition();
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function change(next: number) {
    const clamped = Math.max(1, Math.round(next * 100) / 100);
    setServings(clamped);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startTransition(async () => {
        await setMenuServingsAction(id, clamped);
      });
    }, 400);
  }

  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <MenuButton id={id} isOnMenu={true} />
        <Link
          href={`/recipes/${id}`}
          className="truncate font-medium underline-offset-4 hover:underline"
        >
          {name}
        </Link>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ServingsStepper
          value={servings}
          onChange={change}
          min={1}
          ariaSuffix={` for ${name}`}
        />
        <span className="text-sm text-muted-foreground">servings</span>
      </div>
    </li>
  );
}

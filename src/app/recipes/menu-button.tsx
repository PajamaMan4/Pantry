"use client";

import * as React from "react";
import { NotebookPenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toggleMenuAction } from "./actions";

/**
 * Add/remove a recipe from the Menu. Two render modes:
 *  - icon-only (recipe cards) — a bare toggle button, like FavoriteButton.
 *  - labeled (detail page) — a shadcn Button reading "Add to Menu" / "On Menu".
 */
export function MenuButton({
  id,
  isOnMenu,
  withLabel = false,
  className,
}: {
  id: number;
  isOnMenu: boolean;
  withLabel?: boolean;
  className?: string;
}) {
  const [on, setOn] = React.useState(isOnMenu);
  const [pending, startTransition] = React.useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    startTransition(async () => {
      await toggleMenuAction(id, next);
    });
  }

  if (withLabel) {
    return (
      <Button
        type="button"
        variant={on ? "secondary" : "outline"}
        size="sm"
        onClick={toggle}
        disabled={pending}
        aria-pressed={on}
        className={className}
      >
        <NotebookPenIcon className="size-4" /> {on ? "On Menu" : "Add to Menu"}
      </Button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={on}
      aria-label={on ? "Remove from menu" : "Add to menu"}
      className={cn("text-muted-foreground transition-colors hover:text-primary", className)}
    >
      <NotebookPenIcon className={cn("size-5", on && "text-primary")} />
    </button>
  );
}

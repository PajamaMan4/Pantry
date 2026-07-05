"use client";

import { ChefHatIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWakeLock } from "@/lib/hooks/use-wake-lock";

/**
 * Cook mode: a screen-wake toggle. When on, it prevents the screen from
 * dimming/locking (handy while following a recipe) without changing the page.
 */
export function CookModeToggle({ className }: { className?: string }) {
  const { active, toggle } = useWakeLock();

  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "default" : "outline"}
      aria-pressed={active}
      onClick={toggle}
      className={className}
    >
      <ChefHatIcon className="size-4" /> {active ? "Screen on" : "Cook mode"}
    </Button>
  );
}

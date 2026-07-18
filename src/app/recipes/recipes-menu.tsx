"use client";

import Link from "next/link";
import { MoreHorizontalIcon, PlusIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Overflow menu for the recipes page header. */
export function RecipesMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon" aria-label="More actions">
            <MoreHorizontalIcon className="size-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link href="/recipes/new" />}>
          <PlusIcon className="size-4" /> New recipe
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/recipes/import" />}>
          <SparklesIcon className="size-4" /> Import
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

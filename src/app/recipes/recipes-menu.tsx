"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleHelpIcon, MoreHorizontalIcon, PlusIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HelpDialog } from "@/components/help/help-dialog";

/** Overflow menu for the recipes page header. */
export function RecipesMenu() {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <>
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
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setHelpOpen(true)}>
            <CircleHelpIcon className="size-4" /> Help
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <HelpDialog topicId="recipes" open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}

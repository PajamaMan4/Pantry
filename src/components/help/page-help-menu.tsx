"use client";

import { useState } from "react";
import { CircleHelpIcon, MoreHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HelpDialog } from "./help-dialog";
import type { HelpTopicId } from "@/lib/help";

/**
 * The ⋯ menu for pages that have no actions of their own beyond Help. Pages
 * that already have a kebab menu (recipes, recipe detail, ingredients,
 * ingredient detail) add a Help item to their existing menu instead of using
 * this component — see each menu's own file.
 */
export function PageHelpMenu({ topicId }: { topicId: HelpTopicId }) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" aria-label="More actions">
              <MoreHorizontalIcon className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setHelpOpen(true)}>
            <CircleHelpIcon className="size-4" /> Help
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <HelpDialog topicId={topicId} open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}

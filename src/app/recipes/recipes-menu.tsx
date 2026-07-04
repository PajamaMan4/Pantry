"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontalIcon, NotebookPenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Overflow menu for the recipes page header. */
export function RecipesMenu() {
  const router = useRouter();
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
        <DropdownMenuItem onClick={() => router.push("/menu")}>
          <NotebookPenIcon className="size-4" /> View Menu
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

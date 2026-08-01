"use client";

import * as React from "react";
import { MergeIcon, MoreHorizontalIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MergeIngredientDialog } from "./merge-ingredient-dialog";
import { DeleteIngredientDialog } from "./delete-ingredient-dialog";

export function IngredientDetailActionsMenu({
  ingredientId,
  name,
  others,
  recipeNames,
}: {
  ingredientId: number;
  name: string;
  others: { id: number; name: string }[];
  recipeNames: string[];
}) {
  const [mergeOpen, setMergeOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

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
          <DropdownMenuItem onClick={() => setMergeOpen(true)}>
            <MergeIcon className="size-4" /> Merge duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2Icon className="size-4" /> Delete ingredient
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <MergeIngredientDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        currentId={ingredientId}
        currentName={name}
        others={others}
      />
      <DeleteIngredientDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        id={ingredientId}
        name={name}
        recipeNames={recipeNames}
      />
    </>
  );
}

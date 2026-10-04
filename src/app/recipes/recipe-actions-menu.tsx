"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleHelpIcon, MoreHorizontalIcon, PencilIcon, DownloadIcon, TrashIcon, RulerIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HelpDialog } from "@/components/help/help-dialog";
import { deleteRecipeAction } from "./actions";
import { SYSTEMS, useRecipeView } from "./recipe-view-context";
import type { DisplaySystem } from "@/lib/domain/scaling";

export function RecipeActionsMenu({ recipeId }: { recipeId: number }) {
  const router = useRouter();
  const { system, setSystem } = useRecipeView();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deletePending, startDeleteTransition] = React.useTransition();
  const [helpOpen, setHelpOpen] = React.useState(false);

  function handleExport() {
    const a = document.createElement("a");
    a.href = `/api/recipes/${recipeId}/export`;
    a.download = "";
    a.click();
  }

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
          <DropdownMenuItem onClick={() => router.push(`/recipes/${recipeId}/edit`)}>
            <PencilIcon className="size-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExport}>
            <DownloadIcon className="size-4" /> Export
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <RulerIcon className="size-4" /> Units
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={system}
                onValueChange={(v) => setSystem(v as DisplaySystem)}
              >
                {SYSTEMS.map((s) => (
                  <DropdownMenuRadioItem key={s.value} value={s.value}>
                    {s.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <TrashIcon className="size-4" /> Delete
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setHelpOpen(true)}>
            <CircleHelpIcon className="size-4" /> Help
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <HelpDialog topicId="recipe-detail" open={helpOpen} onOpenChange={setHelpOpen} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this recipe?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the recipe, its ingredients, and tag links. This can&apos;t be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deletePending}
              onClick={() =>
                startDeleteTransition(async () => void (await deleteRecipeAction(recipeId)))
              }
            >
              {deletePending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

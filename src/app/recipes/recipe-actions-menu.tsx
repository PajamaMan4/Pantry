"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontalIcon, PencilIcon, DownloadIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { deleteRecipeAction } from "./actions";

export function RecipeActionsMenu({ recipeId }: { recipeId: number }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deletePending, startDeleteTransition] = React.useTransition();

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
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
            <TrashIcon className="size-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
